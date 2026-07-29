import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';

export default function ScoreModeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/')}>
          <MaterialIcons name="logout" size={21} color={AppTheme.colors.primary} />
        </Pressable>
        <Pressable style={styles.profileButton}>
          <MaterialIcons name="person" size={22} color={AppTheme.colors.textOnPrimary} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>Choose scoreboard</Text>
        <Text style={styles.title}>What do you want to track?</Text>
      </View>

      <View style={styles.options}>
        <AppCard style={styles.optionCard}>
          <Pressable style={styles.optionPressable} onPress={() => router.replace('/(tabs)')}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="sports-tennis" size={28} color={AppTheme.colors.textOnPrimary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Service Score</Text>
              <Text style={styles.optionText}>Track first serve, second serve, aces, faults and winners.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={25} color={AppTheme.colors.primary} />
          </Pressable>
        </AppCard>

        <AppCard style={[styles.optionCard, styles.disabledCard]}>
          <View style={styles.optionPressable}>
            <View style={[styles.optionIcon, styles.disabledIcon]}>
              <MaterialIcons name="query-stats" size={28} color={AppTheme.colors.textSubtle} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, styles.disabledText]}>Global Score</Text>
              <Text style={styles.optionText}>Coming later for full rally and match scoring.</Text>
            </View>
            <Text style={styles.comingSoon}>Soon</Text>
          </View>
        </AppCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  profileButton: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.lg,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  titleBlock: {
    marginTop: 58,
  },
  kicker: {
    color: AppTheme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 40,
  },
  options: {
    gap: 14,
    marginTop: 34,
  },
  optionCard: {
    minHeight: 104,
    padding: 0,
  },
  optionPressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 104,
    padding: 16,
  },
  disabledCard: {
    opacity: 0.68,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radii.md,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  disabledIcon: {
    backgroundColor: AppTheme.colors.surface,
  },
  optionContent: {
    flex: 1,
    gap: 5,
  },
  optionTitle: {
    color: AppTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  disabledText: {
    color: AppTheme.colors.textDisabled,
  },
  optionText: {
    color: AppTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  comingSoon: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
});
