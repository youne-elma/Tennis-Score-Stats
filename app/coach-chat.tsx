import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function CoachChatEntryScreen() {
  const { mode, user } = useAuth();
  const isAuthenticated = mode === 'authenticated' && Boolean(user);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.kicker}>Coach</Text>
          <Text style={styles.title}>Coach Chat</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <AppCard tone={isAuthenticated ? 'gold' : 'muted'} style={styles.card}>
          <View style={styles.iconMark}>
            <MaterialIcons
              name={isAuthenticated ? 'forum' : 'lock'}
              size={30}
              color={AppTheme.colors.textOnPrimary}
            />
          </View>
          <Text style={styles.cardTitle}>
            {isAuthenticated ? 'Coach chat is ready for the next step' : 'Login required'}
          </Text>
          <Text style={styles.cardText}>
            {isAuthenticated
              ? 'Next we will build the message screen so you can ask a coach for feedback on your tennis stats.'
              : 'Coach Chat works with an account, so your conversation can be saved and followed by a coach.'}
          </Text>

          {isAuthenticated ? (
            <View style={styles.statusPill}>
              <MaterialIcons name="check-circle" size={18} color={AppTheme.colors.success} />
              <Text style={styles.statusText}>{user?.email}</Text>
            </View>
          ) : (
            <AppButton title="Login" icon="login" onPress={() => router.push('/auth/login')} />
          )}
        </AppCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  headerTitleBlock: {
    alignItems: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  kicker: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 14,
    maxWidth: 440,
    padding: 22,
    width: '100%',
  },
  iconMark: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  cardTitle: {
    color: AppTheme.colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  cardText: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: AppTheme.colors.surface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  statusText: {
    color: AppTheme.colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
  },
});
