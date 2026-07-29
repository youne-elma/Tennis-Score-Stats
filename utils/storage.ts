import AsyncStorage from '@react-native-async-storage/async-storage';

import { TennisMatch } from '@/types/match';
import { Player } from '@/types/player';

const storageKeys = {
  players: 'tennis-score-stats.players.v1',
  matches: 'tennis-score-stats.matches.v1',
};

export async function loadPlayers() {
  return loadJson<Player[]>(storageKeys.players, []);
}

export async function savePlayers(players: Player[]) {
  await AsyncStorage.setItem(storageKeys.players, JSON.stringify(players));
}

export async function loadMatches() {
  return loadJson<TennisMatch[]>(storageKeys.matches, []);
}

export async function saveMatches(matches: TennisMatch[]) {
  await AsyncStorage.setItem(storageKeys.matches, JSON.stringify(matches));
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
