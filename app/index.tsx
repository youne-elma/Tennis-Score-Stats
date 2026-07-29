import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centerContent}>
        <View style={styles.brandBlock}>
          <View style={styles.logoMark}>
            <MaterialIcons name="sports-tennis" size={34} color={AppTheme.colors.textOnPrimary} />
          </View>
          <Text style={styles.appName}>Tennis Score Stats</Text>
          <Text style={styles.subtitle}>Track service score and match performance.</Text>
        </View>

        <AppCard style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Bienvenue</Text>
          <Text style={styles.welcomeText}>
            Entre directement dans la demo et commence a creer tes joueurs, matchs et statistiques de service.
          </Text>

          <AppButton title="Entrer" icon="arrow-forward" onPress={() => router.replace('/mode')} />
        </AppCard>
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
    gap: 28,
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
  welcomeCard: {
    gap: 16,
  },
  welcomeTitle: {
    color: AppTheme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  welcomeText: {
    color: AppTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
