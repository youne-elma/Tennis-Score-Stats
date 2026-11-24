import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

import type { TennisMatch } from '@/types/match';
import { loadSupabaseMatches, syncSupabaseMatch, type CloudMatch } from '@/utils/supabase-matches';

type MatchAttempt = { id: string; match: TennisMatch };

type SavedMatch = {
  match: TennisMatch;
  revision: number | null;
  pendingId?: string;
  attempt?: MatchAttempt;
  conflict?: { remote: CloudMatch | null };
  blocked?: 'archived-player';
};

type MatchState = {
  entries: Record<string, SavedMatch>;
  load: 'loading' | 'ready' | 'failed';
  refreshing: boolean;
  refreshFailed: boolean;
  uploadingId?: string;
  failedUploads: ReadonlySet<string>;
};

export type MatchSyncStatus = 'synced' | 'pending' | 'syncing' | 'failed' | 'conflict' | 'blocked';

export const emptyAccountMatches: MatchState = {
  entries: {},
  load: 'loading',
  refreshing: false,
  refreshFailed: false,
  failedUploads: new Set(),
};

const localWrites = new Map<string, Promise<unknown>>();
const matchStorage = createAsyncStorage('tennis-score-stats-matches');

export function newMatchId() {
  const bytes = getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function withMatchLock<T>(key: string, write: () => Promise<T>) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(key, write);
  }

  const next = (localWrites.get(key) ?? Promise.resolve()).then(write);
  const settled = next.catch(() => undefined);
  localWrites.set(key, settled);
  void settled.then(() => {
    if (localWrites.get(key) === settled) {
      localWrites.delete(key);
    }
  });
  return next;
}

async function withRequestTimeout<T>(
  signal: AbortSignal,
  timeoutMs: number,
  request: (requestSignal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) {
    abort();
  }
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export class AccountMatches {
  private state = emptyAccountMatches;
  private listeners = new Set<() => void>();
  private loading?: Promise<void>;
  private prefix: string;

  constructor(private readonly userId: string) {
    this.prefix = 'tennis-score-stats.account-match.v1.' + userId + '.';
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(changes: Partial<MatchState>) {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) {
      listener();
    }
  }

  load() {
    if (this.state.load === 'ready') {
      return Promise.resolve();
    }
    if (this.loading) {
      return this.loading;
    }

    this.publish({ load: 'loading' });
    this.loading = this.readEntries().then(
      (entries) => this.publish({ entries, load: 'ready' }),
      () => this.publish({ load: 'failed' }),
    ).finally(() => { this.loading = undefined; });
    return this.loading;
  }

  private async readEntries() {
    const keys = (await matchStorage.getAllKeys()).filter((key) => key.startsWith(this.prefix));
    const entries: Record<string, SavedMatch> = {};
    for (const [key, value] of Object.entries(await matchStorage.getMany(keys))) {
      if (value) {
        entries[key.slice(this.prefix.length)] = JSON.parse(value) as SavedMatch;
      }
    }
    return entries;
  }

  private write(
    matchId: string,
    change: (current: SavedMatch | undefined) => SavedMatch | undefined,
  ) {
    const key = this.prefix + matchId;
    return withMatchLock(key, async () => {
      const value = await matchStorage.getItem(key);
      const previous = value ? JSON.parse(value) as SavedMatch : undefined;
      const next = change(previous);
      if (next !== previous) {
        if (next) {
          // A match and its outstanding upload are committed in the same storage write.
          await matchStorage.setItem(key, JSON.stringify(next));
        } else {
          await matchStorage.removeItem(key);
        }
      }

      if (next || this.state.entries[matchId]) {
        const entries = { ...this.state.entries };
        if (next) {
          entries[matchId] = next;
        } else {
          delete entries[matchId];
        }
        this.publish({ entries });
      }
      return next;
    });
  }

  async edit(matchId: string, change: (match: TennisMatch | undefined) => TennisMatch | undefined) {
    let saved = false;
    await this.write(matchId, (previous) => {
      const match = change(previous?.match);
      if (!match) {
        return previous;
      }
      saved = true;
      if (previous?.match === match) {
        return previous;
      }
      return { ...previous, match, revision: previous?.revision ?? null, pendingId: newMatchId() };
    });
    return saved;
  }

  async refresh(signal: AbortSignal) {
    const before = this.state.entries;
    this.publish({ refreshing: true });
    try {
      const remote = await withRequestTimeout(signal, 25_000, (requestSignal) =>
        loadSupabaseMatches(this.userId, requestSignal));
      const ids = new Set(remote.map(({ match }) => match.id));

      for (const incoming of remote) {
        if (signal.aborted) return;
        await this.write(incoming.match.id, (current) =>
          current?.pendingId || (current?.revision ?? -1) >= incoming.revision ? current : incoming);
      }

      for (const [id, previous] of Object.entries(before)) {
        if (signal.aborted) return;
        if (!ids.has(id) && !previous.pendingId) {
          await this.write(id, (current) =>
            current?.pendingId || current?.revision !== previous.revision ? current : undefined);
        }
      }
      if (!signal.aborted) this.publish({ refreshFailed: false });
    } catch {
      if (!signal.aborted) this.publish({ refreshFailed: true });
    } finally {
      this.publish({ refreshing: false });
    }
  }

  async upload(signal: AbortSignal) {
    for (const [id, entry] of Object.entries(this.state.entries)) {
      if (signal.aborted) return;
      if (!entry.pendingId || entry.conflict || entry.blocked) continue;

      this.publish({ uploadingId: id });
      try {
        const current = await this.write(id, (previous) => {
          if (!previous?.pendingId || previous.conflict || previous.blocked || previous.attempt) {
            return previous;
          }
          return { ...previous, attempt: { id: previous.pendingId, match: previous.match } };
        });
        if (!current?.attempt || signal.aborted) continue;

        const { attempt, revision } = current;
        const result = await withRequestTimeout(signal, 10_000, (requestSignal) =>
          syncSupabaseMatch(this.userId, attempt.id, revision, attempt.match, requestSignal));

        await this.write(id, (previous) => {
          if (previous?.attempt?.id !== attempt.id) return previous;
          if (result.status === 'synced') {
            return {
              match: previous.match,
              revision: result.revision,
              pendingId: previous.pendingId === attempt.id ? undefined : previous.pendingId,
            };
          }
          if (result.status === 'blocked') {
            return { ...previous, attempt: undefined, blocked: result.reason };
          }
          return { ...previous, attempt: undefined, conflict: { remote: result.remote } };
        });
        if (this.state.failedUploads.has(id)) {
          const failedUploads = new Set(this.state.failedUploads);
          failedUploads.delete(id);
          this.publish({ failedUploads });
        }
      } catch {
        if (!signal.aborted) {
          this.publish({ failedUploads: new Set([...this.state.failedUploads, id]) });
        }
      } finally {
        this.publish({ uploadingId: undefined });
      }
    }
  }

  clearBlockedMatch(matchId: string) {
    return this.write(matchId, (current) => current?.blocked ? { ...current, blocked: undefined } : current);
  }

  async resolve(matchId: string, conflict: NonNullable<SavedMatch['conflict']>, choice: 'device' | 'online') {
    let resolved = false;
    await this.write(matchId, (current) => {
      if (!current?.conflict || current.conflict.remote?.revision !== conflict.remote?.revision) {
        return current;
      }
      resolved = true;
      if (choice === 'online') {
        return current.conflict.remote ?? undefined;
      }
      return { match: current.match, revision: current.conflict.remote?.revision ?? null, pendingId: newMatchId() };
    });
    return resolved;
  }
}
