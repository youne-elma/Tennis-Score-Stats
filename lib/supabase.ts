import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim();

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

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Online mode requires a Supabase configuration. You can continue offline.");
  }

  return supabase;
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
