import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();
const missingSupabaseMessage = "Online mode requires a Supabase configuration. You can continue offline.";
let recoveryClientCount = 0;

export const minimumPasswordLength = 6;

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Keep this key aligned with Supabase's default so existing sessions can be read offline.
const sessionStorageKey = supabase && supabaseUrl
  ? 'sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token'
  : undefined;

export async function readStoredSupabaseAccount() {
  if (!sessionStorageKey) return null;
  const raw = Platform.OS === 'web'
    ? window.localStorage.getItem(sessionStorageKey)
    : await AsyncStorage.getItem(sessionStorageKey);
  const session = raw ? JSON.parse(raw) as { user?: { id?: string } } : null;
  return typeof session?.user?.id === 'string' ? session.user.id : null;
}

export async function clearStoredSupabaseSession() {
  if (!sessionStorageKey) return;
  const keys = [sessionStorageKey, sessionStorageKey + '-code-verifier', sessionStorageKey + '-user'];
  if (Platform.OS === 'web') {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } else {
    await AsyncStorage.removeMany(keys);
  }
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(missingSupabaseMessage);
  }

  return supabase;
}

export function createPasswordRecoveryAuth() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(missingSupabaseMessage);
  }

  recoveryClientCount += 1;
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: `tennis-score-stats-password-recovery-${recoveryClientCount}`,
    },
  }).auth;
}

if (supabase && Platform.OS !== "web") {
  const { auth } = supabase;
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      auth.startAutoRefresh();
    } else {
      auth.stopAutoRefresh();
    }
  });
}
