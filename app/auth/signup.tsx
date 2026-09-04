import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppTheme } from '@/constants/theme';
import { isEmailAlreadyRegisteredError, useAuth } from '@/contexts/auth-context';

const loginRoute = '/auth/login' as Href;

export default function SignupScreen() {
  const { continueOffline, signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enterOffline = () => {
    continueOffline();
    router.replace('/mode');
  };

  const submitSignup = async () => {
    const nextName = name.trim();
    const nextEmail = email.trim();

    if (!nextName || !nextEmail || !password || !confirmPassword) {
      Alert.alert('Missing information', 'Name, email and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Password and confirmation must match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp(nextName, nextEmail, password);

      if (result.needsEmailConfirmation) {
        router.replace({
          pathname: '/auth/check-email',
          params: { email: nextEmail },
        });
        return;
      }

      router.replace('/mode');
    } catch (error) {
      if (isEmailAlreadyRegisteredError(error)) {
        Alert.alert('Account already exists', 'This email is already linked to an account. Login instead.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to login', onPress: () => router.replace(loginRoute) },
        ]);
        return;
      }

      Alert.alert('Signup failed', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
          <AppInput label="Name" placeholder="Coach Kamal" value={name} onChangeText={setName} />
          <AppInput
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AppInput label="Password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <AppInput
            label="Confirm password"
            placeholder="Confirm password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <AppButton
            title={isSubmitting ? 'Creating account...' : 'Create account'}
            icon="person-add"
            disabled={isSubmitting}
            onPress={submitSignup}
          />
        </AppCard>

        <View style={styles.bottomActions}>
          <AppButton
            title="Continue offline"
            icon="sports-tennis"
            variant="secondary"
            onPress={enterOffline}
          />
          <Pressable onPress={() => router.replace(loginRoute)}>
            <Text style={styles.switchText}>Already have an account? Login</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Please try again.';
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
