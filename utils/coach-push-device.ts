import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { requireSupabase } from '@/lib/supabase';

type CoachPushDevice = {
  userId: string;
  token: string;
  enabled: boolean;
};

const storageKey = 'tennis-score-stats.coach-push-device.v1';
const requestTimeout = 5_000;
let deviceChanges: Promise<unknown> = Promise.resolve();

export async function readCoachPushDevice(): Promise<CoachPushDevice | null> {
  const stored = await AsyncStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }
  try {
    const device = JSON.parse(stored) as Partial<CoachPushDevice> | null;
    if (device && typeof device.userId === 'string' && typeof device.token === 'string' && typeof device.enabled === 'boolean') {
      return { userId: device.userId, token: device.token, enabled: device.enabled };
    }
  } catch {
    // An invalid local value can be replaced when the player enables notifications.
  }
  return null;
}

function changeDevice<T>(operation: () => Promise<T>) {
  const next = deviceChanges.then(operation);
  deviceChanges = next.catch(() => undefined);
  return next;
}

async function withRequestTimeout<T>(request: (signal: AbortSignal) => PromiseLike<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeout);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export function registerCoachPushDevice(userId: string, token: string, restore = false) {
  return changeDevice(async () => {
    const previous = await readCoachPushDevice();
    if (restore && (previous?.userId !== userId || !previous.enabled)) {
      return false;
    }

    const next = { userId, token, enabled: true };
    const changed = previous?.userId !== userId || previous?.token !== token || !previous.enabled;
    if (changed) {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    }

    try {
      const { error } = await withRequestTimeout((signal) => requireSupabase()
        .rpc('register_coach_push_device', {
          p_user_id: userId,
          p_expo_token: token,
          p_previous_token: previous?.userId === userId ? previous.token : null,
        })
        .abortSignal(signal));
      if (error) {
        throw error;
      }
      return true;
    } catch (error) {
      if (changed) {
        if (previous) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(previous));
        } else {
          await AsyncStorage.removeItem(storageKey);
        }
      }
      throw error;
    }
  });
}

export async function disableCoachPushDevice(userId: string) {
  if (Platform.OS === 'web') {
    return;
  }

  await changeDevice(async () => {
    const previous = await readCoachPushDevice();
    if (!previous || previous.userId !== userId) {
      return;
    }

    // Keep the token for a later retry when sign-out or disabling occurs offline.
    await AsyncStorage.setItem(storageKey, JSON.stringify({ ...previous, enabled: false }));
    const { error } = await withRequestTimeout((signal) => requireSupabase()
      .from('coach_push_devices')
      .delete()
      .eq('user_id', userId)
      .eq('expo_token', previous.token)
      .abortSignal(signal));
    if (error) {
      throw error;
    }

    await AsyncStorage.removeItem(storageKey);
  });
}
