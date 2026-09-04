import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const loginRoute = '/auth/login' as Href;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { continueOffline } = useAuth();
  const userEmail = typeof email === 'string' ? email : '';

  const enterOffline = () => {
    continueOffline();
    router.replace('/mode');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace(loginRoute)}>
          <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.titleBlock}>
          <View style={styles.mailIcon}>
            <MaterialIcons name="mail" size={32} color={AppTheme.colors.textOnPrimary} />
          </View>
          <Text style={styles.kicker}>Confirm your account</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We sent a confirmation link to your email address.</Text>
        </View>

        <AppCard style={styles.card}>
          {userEmail ? <Text style={styles.email}>{userEmail}</Text> : null}
          <Text style={styles.bodyText}>
            Confirm your email address, then come back and login to sync your tennis stats later.
          </Text>
        </AppCard>

        <View style={styles.bottomActions}>
          <AppButton title="Go to login" icon="login" onPress={() => router.replace(loginRoute)} />
          <AppButton title="Continue offline" icon="sports-tennis" variant="secondary" onPress={enterOffline} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  header: {
    alignItems: 'flex-start',
  },
  iconButton: {
    alignItems: 'center',
    borderColor: AppTheme.colors.borderGold,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    gap: 24,
    justifyContent: 'center',
    maxWidth: 460,
    width: '100%',
  },
  titleBlock: {
    gap: 10,
  },
  mailIcon: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    height: 58,
    justifyContent: 'center',
    marginBottom: 8,
    width: 58,
  },
  kicker: {
    color: AppTheme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 42,
  },
  subtitle: {
    color: AppTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 12,
  },
  email: {
    color: AppTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  bodyText: {
    color: AppTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomActions: {
    gap: 14,
  },
});
