import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMatches } from '@/contexts/matches-context';
import { usePlayers } from '@/contexts/players-context';
import { findResumeMatch } from '@/utils/resume-match';
import { formatSharedMatchScore } from '@/utils/shared-match-stats';
import { loadOpenedMatchIds } from '@/utils/storage';

export function ResumeMatchCard() {
  const { accountId, isLoading: isLoadingAccount } = useAuth();
  const { matches, isLoadingMatches, matchesLoadFailed } = useMatches();
  const { players, isLoadingPlayers } = usePlayers();
  const [openedMatches, setOpenedMatches] = useState<{ accountId: string | null; ids: string[] }>();

  useFocusEffect(useCallback(() => {
    if (isLoadingAccount) return;

    let active = true;
    void loadOpenedMatchIds(accountId).catch(() => []).then((ids) => {
      if (active) setOpenedMatches({ accountId, ids });
    });
    return () => { active = false; };
  }, [accountId, isLoadingAccount]));

  const playerNames = useMemo(() => new Map(
    players.map((player) => [player.id, player.firstName + ' ' + player.lastName]),
  ), [players]);

  const resume = useMemo(() => {
    if (
      isLoadingAccount || isLoadingMatches || matchesLoadFailed || isLoadingPlayers
      || openedMatches?.accountId !== accountId
    ) return;

    const available = matches.filter((match) => playerNames.has(match.player1Id) && playerNames.has(match.player2Id));
    return findResumeMatch(available, openedMatches.ids);
  }, [accountId, isLoadingAccount, isLoadingMatches, isLoadingPlayers, matches, matchesLoadFailed, openedMatches, playerNames]);

  if (!resume) return null;

  const { match, score } = resume;
  const matchup = playerNames.get(match.player1Id) + ' vs ' + playerNames.get(match.player2Id);
  const status = formatSharedMatchScore(score) + ' · ' + match.status;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume match, ${matchup}, ${status}`}
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <AppCard tone="gold" style={styles.card}>
        <View style={styles.details}>
          <Text style={styles.title}>Resume match</Text>
          <Text numberOfLines={2} style={styles.matchup}>{matchup}</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
        <MaterialIcons name="play-arrow" size={26} color={AppTheme.colors.primary} />
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  details: { flex: 1, gap: 3 },
  title: { color: AppTheme.colors.primary, fontSize: 16, fontWeight: '900' },
  matchup: { color: AppTheme.colors.text, fontSize: 15, fontWeight: '700' },
  status: { color: AppTheme.colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.8 },
});
