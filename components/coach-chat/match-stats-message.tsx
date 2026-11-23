import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import type { SharedMatchStats } from '@/utils/shared-match-stats';

export function MatchStatsMessage({ stats }: { stats: SharedMatchStats }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Match stats</Text>
      <Text style={styles.score}>Score {stats.score}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Statistic</Text>
        <Text style={styles.player}>{stats.player1Name}</Text>
        <Text style={styles.player}>{stats.player2Name}</Text>
      </View>
      {stats.summary.map((row, index) => (
        <View key={`${row.label}-${index}`} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.player1Value}</Text>
          <Text style={styles.value}>{row.player2Value}</Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        style={styles.detailsButton}
        onPress={() => setShowDetails(!showDetails)}>
        <Text style={styles.detailsLabel}>{showDetails ? 'Hide serve breakdown' : 'View serve breakdown'}</Text>
      </Pressable>
      {showDetails ? <Text style={styles.details}>{stats.details}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
  },
  title: {
    color: AppTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  score: {
    color: AppTheme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    alignItems: 'center',
    borderTopColor: AppTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 7,
  },
  label: {
    color: AppTheme.colors.textMuted,
    flex: 1.5,
    fontSize: 12,
  },
  player: {
    color: AppTheme.colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  value: {
    color: AppTheme.colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailsButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  detailsLabel: {
    color: AppTheme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  details: {
    color: AppTheme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
