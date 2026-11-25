import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { CoachReplyNotification } from '@/components/coach-chat/reply-notification';
import { AuthProvider } from '@/contexts/auth-context';
import { CoachNotificationsProvider } from '@/contexts/coach-notifications-context';
import { MatchesProvider } from '@/contexts/matches-context';
import { PlayersProvider } from '@/contexts/players-context';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AuthProvider>
        <CoachNotificationsProvider>
          <PlayersProvider>
            <MatchesProvider>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="auth/check-email" options={{ headerShown: false }} />
                <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
                <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
                <Stack.Screen name="mode" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="coach-chat" options={{ headerShown: false }} />
                <Stack.Screen name="coach-applications" options={{ headerShown: false }} />
                <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
            </MatchesProvider>
          </PlayersProvider>
          <CoachReplyNotification />
        </CoachNotificationsProvider>
      </AuthProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
