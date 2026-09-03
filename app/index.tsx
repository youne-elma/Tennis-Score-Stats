import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppTheme } from '@/constants/theme';

const loginRoute = '/auth/login' as Href;
const signupRoute = '/auth/signup' as Href;

export default function AuthGatewayScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centerContent}>
        <View style={styles.brandBlock}>
          <View style={styles.logoMark}>
            <MaterialIcons name="sports-tennis" size={34} color={AppTheme.colors.textOnPrimary} />
          </View>
          <Text style={styles.appName}>Tennis Score Stats</Text>
          <Text style={styles.subtitle}>Track your serve like a coach.</Text>
        </View>

        <View style={styles.actions}>
          <AppButton title="Continue offline" icon="sports-tennis" onPress={() => router.replace('/mode')} />
          <AppButton title="Login" icon="login" variant="secondary" onPress={() => router.push(loginRoute)} />
          <AppButton
            title="Create account"
            icon="person-add"
            variant="secondary"
            onPress={() => router.push(signupRoute)}
          />
        </View>

        <Text style={styles.offlineHint}>No account needed. Your data stays on this device in offline mode.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  centerContent: {
    alignSelf: 'center',
    gap: 28,
    maxWidth: 440,
    width: '100%',
  },
  brandBlock: {
    alignItems: 'center',
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    height: 64,
    justifyContent: 'center',
    marginBottom: 22,
    width: 64,
  },
  appName: {
    color: AppTheme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 42,
    textAlign: 'center',
  },
  subtitle: {
    color: AppTheme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 300,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  offlineHint: {
    color: AppTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
