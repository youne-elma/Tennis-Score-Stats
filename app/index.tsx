import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppTheme, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const loginRoute = '/auth/login' as Href;
const signupRoute = '/auth/signup' as Href;

const tennisBall = [
  '   ,odOO"bo,',
  " ,dOOOP'dOOOb,",
  ",O3OP'dOO3OO33,",
  'P",ad33O333O3Ob',
  '?833O338333P",d',
  "`88383838P,d38'",
  " `Y8888P,d88P'",
  "   `\"?8,8P\"'",
].join('\n');

const ballDrift = {
  animationName: {
    from: { transform: [{ translateX: 0 }, { translateY: 2 }, { rotate: '-8deg' }] },
    to: { transform: [{ translateX: 9 }, { translateY: -10 }, { rotate: '8deg' }] },
  },
  animationDuration: 7200,
  animationDirection: 'alternate' as const,
  animationIterationCount: 'infinite' as const,
  animationTimingFunction: 'ease-in-out' as const,
};

export default function AuthGatewayScreen() {
  const { continueOffline } = useAuth();

  const enterOffline = () => {
    continueOffline();
    router.replace('/mode');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <TennisBackground />
      <View style={styles.centerContent}>
        <View style={styles.brandBlock}>
          <View style={styles.logoMark}>
            <MaterialIcons name="sports-tennis" size={34} color={AppTheme.colors.textOnPrimary} />
          </View>
          <Text style={styles.appName}>Tennis Score Stats</Text>
          <Text style={styles.subtitle}>Track your serve like a coach.</Text>
        </View>

        <View style={styles.actions}>
          <AppButton title="Continue offline" icon="sports-tennis" onPress={enterOffline} />
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

function TennisBackground() {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const animate = isFocused && !reduceMotion;

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.backgroundLayer}>
      <Animated.Text style={[styles.asciiBall, styles.upperBall, animate && ballDrift]}>
        {tennisBall}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.asciiBall,
          styles.lowerBall,
          animate && { ...ballDrift, animationDuration: 9000, animationDirection: 'alternate-reverse' },
        ]}>
        {tennisBall}
      </Animated.Text>
    </View>
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
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  asciiBall: {
    position: 'absolute',
    color: AppTheme.colors.primary,
    fontFamily: Fonts?.mono,
    includeFontPadding: false,
  },
  upperBall: {
    top: '15%',
    left: '12%',
    fontSize: 8,
    lineHeight: 9,
    opacity: 0.24,
  },
  lowerBall: {
    bottom: '13%',
    right: '13%',
    fontSize: 7,
    lineHeight: 8,
    opacity: 0.18,
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
