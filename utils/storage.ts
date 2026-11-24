import AsyncStorage from '@react-native-async-storage/async-storage';

import { TennisMatch } from '@/types/match';
import { Player } from '@/types/player';

const storageKeys = {
  players: 'tennis-score-stats.players.v1',
  matches: 'tennis-score-stats.matches.v1',
  openedMatches: 'tennis-score-stats.opened-matches.v1',
};

const openedMatchWrites = new Map<string, Promise<unknown>>();

function playersKey(accountId?: string | null) {
  return accountId ? storageKeys.players + '.' + accountId : storageKeys.players;
}

export async function loadPlayers(accountId?: string | null) {
  return loadJson<Player[]>(playersKey(accountId), []);
}

export async function savePlayers(players: Player[], accountId?: string | null) {
  await AsyncStorage.setItem(playersKey(accountId), JSON.stringify(players));
}

export async function loadMatches() {
  return loadJson<TennisMatch[]>(storageKeys.matches, []);
}

export async function saveMatches(matches: TennisMatch[]) {
  await AsyncStorage.setItem(storageKeys.matches, JSON.stringify(matches));
}

function openedMatchesKey(accountId: string | null) {
  return storageKeys.openedMatches + (accountId ? '.account.' + accountId : '.guest');
}

async function readOpenedMatchIds(key: string) {
  const stored = await loadJson<unknown>(key, []);
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
}

export async function loadOpenedMatchIds(accountId: string | null) {
  const key = openedMatchesKey(accountId);
  await openedMatchWrites.get(key);
  return readOpenedMatchIds(key);
}

export function rememberOpenedMatch(accountId: string | null, matchId: string) {
  const key = openedMatchesKey(accountId);
  const write = (openedMatchWrites.get(key) ?? Promise.resolve()).then(async () => {
    const ids = await readOpenedMatchIds(key);
    if (ids[0] !== matchId) {
      await AsyncStorage.setItem(key, JSON.stringify([matchId, ...ids.filter((id) => id !== matchId)]));
    }
  });
  const settled = write.catch(() => undefined);
  openedMatchWrites.set(key, settled);
  void settled.then(() => {
    if (openedMatchWrites.get(key) === settled) {
      openedMatchWrites.delete(key);
    }
  });
  return write;
}

async function loadJson<T>(key: string, fallback: T) {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}
