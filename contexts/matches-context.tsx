import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { MatchFormValues, ServiceEvent, ServiceEventInput, TennisMatch } from '@/types/match';
import { AccountMatches, emptyAccountMatches, newMatchId, type MatchSyncStatus } from '@/utils/account-matches';
import { loadMatches, saveMatches } from '@/utils/storage';
import { calculateTennisScore } from '@/utils/tennis-score';

type MatchSync = {
  status: MatchSyncStatus;
  conflict?: { remote: { match: TennisMatch; revision: number } | null };
};

type MatchesContextValue = {
  matches: TennisMatch[];
  isLoadingMatches: boolean;
  matchesLoadFailed: boolean;
  cloudHistoryFailed: boolean;
  writeError?: string;
  retryLoadMatches: () => void;
  retryMatchSync: (matchId: string) => Promise<void>;
  resolveMatchConflict: (matchId: string, conflict: NonNullable<MatchSync['conflict']>, choice: 'device' | 'online') => Promise<boolean>;
  getMatchSync: (matchId: string) => MatchSync | undefined;
  addMatch: (match: MatchFormValues) => Promise<boolean>;
  updateMatchStatus: (id: string, status: TennisMatch['status']) => Promise<boolean>;
  pauseMatch: (id: string, pauseReason: string) => Promise<boolean>;
  updateMatchSettings: (id: string, settings: Partial<MatchFormValues>) => Promise<boolean>;
  recordServiceEvent: (event: ServiceEventInput) => Promise<boolean>;
  updateServiceEvent: (matchId: string, eventId: string, event: Partial<ServiceEvent>) => Promise<boolean>;
  undoLastServiceEvent: (matchId: string) => Promise<boolean>;
};

const MatchesContext = createContext<MatchesContextValue | null>(null);
const emptyMatches: TennisMatch[] = [];
const noSubscription = () => () => undefined;
const noAccountMatches = () => emptyAccountMatches;

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { mode, accountId, isOnline } = useAuth();
  const store = useMemo(() => accountId ? new AccountMatches(accountId) : null, [accountId]);
  const account = useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getSnapshot ?? noAccountMatches, noAccountMatches);
  const [guest, setGuest] = useState<{ matches: TennisMatch[]; failed: boolean }>();
  const [guestAttempt, setGuestAttempt] = useState(0);
  const [writeFailure, setWriteFailure] = useState<{ store: AccountMatches | null; message: string }>();
  const guestWrite = useRef<Promise<unknown>>(Promise.resolve());
  const sync = useRef<{ store: AccountMatches; request: (refresh?: boolean) => void }>(undefined);
  const [isActive, setActive] = useState(() => !AppState.currentState || AppState.currentState === 'active');
  const isGuest = mode !== 'loading' && !accountId;
  const ready = account.load === 'ready';

  useEffect(() => {
    const watcher = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => watcher.remove();
  }, []);

  useEffect(() => {
    if (store) void store.load();
  }, [store]);

  useEffect(() => {
    if (!isGuest) return;
    let active = true;
    void guestWrite.current.then(loadMatches).then(
      (matches) => { if (active) setGuest({ matches, failed: false }); },
      () => { if (active) setGuest({ matches: emptyMatches, failed: true }); },
    );
    return () => { active = false; };
  }, [guestAttempt, isGuest]);

  useEffect(() => {
    if (!store || !ready || mode !== 'authenticated' || !isOnline || !isActive) return;
    const accountStore = store;
    const controller = new AbortController();
    let running = false;
    let requested = false;
    let refreshNeeded = true;

    async function run() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        do {
          requested = false;
          await accountStore.upload(controller.signal);
          if (refreshNeeded && !controller.signal.aborted) {
            refreshNeeded = false;
            await accountStore.refresh(controller.signal);
          }
        } while (requested && !controller.signal.aborted);
      } finally {
        running = false;
      }
    }

    const request = (refresh = false) => {
      requested = true;
      refreshNeeded ||= refresh;
      void run();
    };

    sync.current = { store, request };
    const interval = setInterval(() => request(accountStore.getSnapshot().refreshFailed), 12_000);
    request();
    return () => {
      controller.abort();
      clearInterval(interval);
      sync.current = undefined;
    };
  }, [isActive, isOnline, mode, ready, store]);

  const requestSync = useCallback((refresh = false) => {
    if (sync.current?.store === store) sync.current.request(refresh);
  }, [store]);

  const retryLoadMatches = useCallback(() => {
    if (store) {
      void store.load().then(() => requestSync(true));
    } else {
      setGuest(undefined);
      setGuestAttempt((attempt) => attempt + 1);
    }
  }, [requestSync, store]);

  const updateMatch = useCallback(async (id: string, change: (match: TennisMatch | undefined) => TennisMatch | undefined) => {
    setWriteFailure(undefined);
    try {
      if (store) {
        if (store.getSnapshot().load !== 'ready') return false;
        const saved = await store.edit(id, change);
        if (saved) {
          requestSync();
        } else {
          setWriteFailure({ store, message: 'The match changed. Check the score and try again.' });
        }
        return saved;
      }

      const operation = guestWrite.current.then(async () => {
        const current = await loadMatches();
        const existing = current.find((match) => match.id === id);
        const match = change(existing);
        if (!match) return false;
        if (match !== existing) {
          const matches = existing ? current.map((item) => item.id === id ? match : item) : [match, ...current];
          await saveMatches(matches);
          setGuest({ matches, failed: false });
        }
        return true;
      });
      guestWrite.current = operation.catch(() => undefined);
      return await operation;
    } catch {
      setWriteFailure({ store, message: 'Could not save the change on this device. Try again.' });
      return false;
    }
  }, [requestSync, store]);

  const matches = useMemo(() => store
    ? Object.values(account.entries).map(({ match }) => match).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : isGuest ? guest?.matches ?? emptyMatches : emptyMatches, [account.entries, guest, isGuest, store]);

  const value = useMemo<MatchesContextValue>(() => ({
    matches,
    isLoadingMatches: store ? account.load === 'loading' || (!matches.length && account.refreshing) : !isGuest || !guest,
    matchesLoadFailed: store ? account.load === 'failed' : Boolean(isGuest && guest?.failed),
    cloudHistoryFailed: Boolean(store && account.refreshFailed),
    writeError: writeFailure?.store === store ? writeFailure?.message : undefined,
    retryLoadMatches,
    retryMatchSync: async (matchId) => {
      try {
        await store?.clearBlockedMatch(matchId);
        requestSync();
      } catch {
        setWriteFailure({ store, message: 'Could not read the saved match. Try again.' });
      }
    },
    resolveMatchConflict: async (matchId, conflict, choice) => {
      if (!store) return false;
      try {
        const resolved = await store.resolve(matchId, conflict, choice);
        if (resolved) requestSync();
        return resolved;
      } catch {
        setWriteFailure({ store, message: 'Could not save your choice. Try again.' });
        return false;
      }
    },
    getMatchSync: (matchId) => {
      const entry = account.entries[matchId];
      if (!entry) return undefined;
      if (entry.conflict) return { status: 'conflict', conflict: entry.conflict };
      if (entry.blocked) return { status: 'blocked' };
      if (account.uploadingId === matchId) return { status: 'syncing' };
      if (!entry.pendingId) return { status: 'synced' };
      return { status: isOnline && account.failedUploads.has(matchId) ? 'failed' : 'pending' };
    },
    addMatch: async (form) => {
      const id = newMatchId();
      return updateMatch(id, () => ({
        ...form,
        id,
        createdAt: new Date().toISOString(),
        status: 'Not started',
        serviceEvents: [],
      }));
    },
    updateMatchStatus: (id, status) => updateMatch(id, (match) => {
      if (!match || match.status === status) return match;
      return {
        ...match,
        status,
        endedAt: status === 'Ended' ? new Date().toISOString() : undefined,
      };
    }),
    pauseMatch: (id, pauseReason) => updateMatch(id, (match) =>
      match ? { ...match, status: 'Paused', pauseReason } : undefined),
    updateMatchSettings: (id, settings) => updateMatch(id, (match) =>
      match ? withServiceEvents({ ...match, ...settings }, match.serviceEvents) : undefined),
    recordServiceEvent: (event) => updateMatch(event.matchId, (match) => {
      if (!match || match.status === 'Ended') return undefined;
      const score = calculateTennisScore(match);
      const last = match.serviceEvents.at(-1);
      const phase = last?.phase === 'First Serve' && last.action === 'Fault' ? 'Second Serve' : 'First Serve';
      if (score.matchWinnerId || event.serverId !== score.currentServerId || event.phase !== phase) return undefined;
      const now = Math.max(Date.now(), last ? Date.parse(last.createdAt) + 1 : 0);
      const next = { ...event, id: newMatchId(), createdAt: new Date(now).toISOString() };
      return withServiceEvents({ ...match, status: 'In progress' }, [...match.serviceEvents, next]);
    }),
    updateServiceEvent: (matchId, eventId, event) => updateMatch(matchId, (match) => {
      if (!match || !match.serviceEvents.some((item) => item.id === eventId)) return undefined;
      return withServiceEvents(match, match.serviceEvents.map((item) =>
        item.id === eventId ? { ...item, ...event, id: item.id, matchId, createdAt: item.createdAt } : item));
    }),
    undoLastServiceEvent: (matchId) => updateMatch(matchId, (match) =>
      match?.serviceEvents.length ? withServiceEvents(match, match.serviceEvents.slice(0, -1)) : undefined),
  }), [account, guest, isGuest, isOnline, matches, requestSync, retryLoadMatches, store, updateMatch, writeFailure]);

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

function withServiceEvents(match: TennisMatch, serviceEvents: ServiceEvent[]): TennisMatch {
  const updated = { ...match, serviceEvents };
  if (calculateTennisScore(updated).matchWinnerId) {
    return { ...updated, status: 'Ended', endedAt: match.endedAt ?? new Date().toISOString() };
  }
  if (match.status === 'Ended' && calculateTennisScore(match).matchWinnerId) {
    return { ...updated, status: 'In progress', endedAt: undefined };
  }
  return updated;
}

export function useMatches() {
  const context = useContext(MatchesContext);

  if (!context) {
    throw new Error('useMatches must be used inside MatchesProvider');
  }

  return context;
}
