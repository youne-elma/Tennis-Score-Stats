import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppTheme } from '@/constants/theme';

const loginRoute = '/auth/login' as Href;

export default function SignupScreen() {
  const showComingSoon = () => {
    Alert.alert('Signup coming soon', 'Account creation is not connected yet. Continue offline for now.');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>New account</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Prepare for future cloud backup, player profiles and multi-device stats.</Text>
        </View>

        <AppCard style={styles.form}>
          <AppInput label="Name" placeholder="Coach Kamal" />
          <AppInput label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          <AppInput label="Password" placeholder="Password" secureTextEntry />
          <AppInput label="Confirm password" placeholder="Confirm password" secureTextEntry />

          <AppButton title="Create account" icon="person-add" onPress={showComingSoon} />
        </AppCard>

        <View style={styles.bottomActions}>
          <AppButton
            title="Continue offline"
            icon="sports-tennis"
            variant="secondary"
            onPress={() => router.replace('/mode')}
          />
          <Pressable onPress={() => router.replace(loginRoute)}>
            <Text style={styles.switchText}>Already have an account? Login</Text>
          </Pressable>
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
  form: {
    gap: 16,
  },
  bottomActions: {
    gap: 14,
  },
  switchText: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
