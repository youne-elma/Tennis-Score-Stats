import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { isAuthSessionMissingError, isAuthWeakPasswordError } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppInput } from '@/components/ui/app-input';
import { AppTheme } from '@/constants/theme';
import { createPasswordRecoveryAuth, minimumPasswordLength, requireSupabase } from '@/lib/supabase';

type RecoveryAuth = ReturnType<typeof createPasswordRecoveryAuth>;
type Operation = 'send' | 'reset';

export default function ResetPasswordScreen() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof initialEmail === 'string' ? initialEmail : '');
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null);
  const activeOperation = useRef<Operation | null>(null);
  const recoveryAuth = useRef<RecoveryAuth | null>(null);
  const isBusy = operation !== null;

  useEffect(() => () => {
    const auth = recoveryAuth.current;
    recoveryAuth.current = null;

    // An in-flight reset releases its client when it finishes.
    if (auth && activeOperation.current !== 'reset') {
      void closeRecoveryAuth(auth);
    }
  }, []);

  async function sendCode() {
    if (activeOperation.current) {
      return;
    }

    const nextEmail = requestedEmail ?? email.trim();
    if (!nextEmail) {
      setErrorMessage('Enter your email address.');
      return;
    }

    activeOperation.current = 'send';
    setOperation('send');
    setErrorMessage('');
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(nextEmail);

      if (error && error.code !== 'user_not_found' && error.code !== 'email_address_not_authorized') {
        setErrorMessage(error.status === 429
          ? 'Please wait before requesting another code.'
          : 'Could not request a code. Check your email address and try again.');
        return;
      }

      setRequestedEmail(nextEmail);
      setCode('');
    } catch {
      setErrorMessage('Password recovery is unavailable right now.');
    } finally {
      activeOperation.current = null;
      setOperation(null);
    }
  }

  function changeEmail() {
    setRequestedEmail(null);
    setCode('');
    setPassword('');
    setConfirmation('');
    setErrorMessage('');
  }

  async function resetPassword() {
    if (!requestedEmail || activeOperation.current) {
      return;
    }

    const enteredCode = code.replace(/\s/g, '');
    if (!codeVerified && !enteredCode) {
      setErrorMessage('Enter the code from your email.');
      return;
    }

    if (password.length < minimumPasswordLength) {
      setErrorMessage('Use at least ' + minimumPasswordLength + ' characters for your new password.');
      return;
    }

    if (password !== confirmation) {
      setErrorMessage('Password and confirmation must match.');
      return;
    }

    activeOperation.current = 'reset';
    setOperation('reset');
    setErrorMessage('');
    let auth: RecoveryAuth | undefined;
    try {
      auth = recoveryAuth.current ??= createPasswordRecoveryAuth();
      if (!codeVerified) {
        const { data, error } = await auth.verifyOtp({ email: requestedEmail, token: enteredCode, type: 'recovery' });
        if (recoveryAuth.current !== auth) {
          return;
        }
        if (error || !data.session) {
          setErrorMessage(error?.code === 'otp_expired'
            ? 'This code is invalid or has expired. You can request a new one.'
            : 'Could not verify this code. Try again.');
          return;
        }

        setCodeVerified(true);
        setCode('');
      }

      const { error } = await auth.updateUser({ password });
      if (recoveryAuth.current !== auth) {
        return;
      }
      if (error) {
        if (isAuthSessionMissingError(error) || error.code === 'session_not_found' || error.code === 'refresh_token_not_found') {
          recoveryAuth.current = null;
          setCodeVerified(false);
          setErrorMessage('Your recovery session expired. Request a new code.');
        } else if (error.code === 'same_password') {
          setErrorMessage('Choose a password different from your previous password.');
        } else if (isAuthWeakPasswordError(error)) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not update your password. Try again.');
        }
        return;
      }

      recoveryAuth.current = null;
      router.dismissTo({
        pathname: '/auth/login',
        params: { email: requestedEmail, passwordReset: 'complete' },
      });
    } catch {
      setErrorMessage('Could not reset your password. Try again.');
    } finally {
      activeOperation.current = null;
      setOperation(null);
      if (auth && recoveryAuth.current !== auth) {
        void closeRecoveryAuth(auth);
      }
    }
  }

  const feedback = errorMessage ? (
    <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>
  ) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to login"
            style={styles.backButton}
            onPress={() => router.dismissTo('/auth/login')}>
            <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>Reset password</Text>
          <AppCard style={styles.form}>
            {requestedEmail ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.info}>
                  {codeVerified
                    ? 'Code verified. Confirm your new password to continue.'
                    : 'If an account is linked to ' + requestedEmail + ', you will receive a reset code by email.'}
                </Text>
                {!codeVerified ? (
                  <AppInput
                    label="Reset code"
                    accessibilityLabel="Reset code"
                    placeholder="Code from your email"
                    autoComplete="one-time-code"
                    keyboardType="number-pad"
                    value={code}
                    editable={!isBusy}
                    onChangeText={setCode}
                  />
                ) : null}
                <AppInput
                  label="New password"
                  accessibilityLabel="New password"
                  placeholder="New password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  secureTextEntry
                  value={password}
                  editable={!isBusy}
                  onChangeText={setPassword}
                />
                <AppInput
                  label="Confirm new password"
                  accessibilityLabel="Confirm new password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  secureTextEntry
                  value={confirmation}
                  editable={!isBusy}
                  onChangeText={setConfirmation}
                />
                {feedback}
                <AppButton
                  title={operation === 'reset' ? 'Updating password…' : 'Update password'}
                  icon="check"
                  disabled={isBusy}
                  onPress={resetPassword}
                />
                {!codeVerified ? (
                  <View style={styles.codeActions}>
                    <AppButton
                      title={operation === 'send' ? 'Requesting code…' : 'Resend code'}
                      variant="ghost"
                      disabled={isBusy}
                      onPress={sendCode}
                    />
                    <AppButton title="Change email" variant="ghost" disabled={isBusy} onPress={changeEmail} />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <AppInput
                  label="Account email"
                  accessibilityLabel="Account email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  editable={!isBusy}
                  onChangeText={setEmail}
                />
                {feedback}
                <AppButton
                  title={operation === 'send' ? 'Requesting code…' : 'Send reset code'}
                  icon="mail"
                  disabled={isBusy}
                  onPress={sendCode}
                />
              </>
            )}
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function closeRecoveryAuth(auth: RecoveryAuth) {
  await auth.signOut({ scope: 'local' }).catch(() => undefined);
  await auth.dispose();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  body: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
  },
  backButton: {
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
    flexGrow: 1,
    gap: 24,
    justifyContent: 'center',
    maxWidth: 460,
    paddingVertical: 24,
    width: '100%',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  form: {
    gap: 16,
  },
  info: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: AppTheme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  codeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
