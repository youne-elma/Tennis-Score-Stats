import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressionChart, progressionSeriesColors } from '@/components/progression-chart';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { AppModal } from '@/components/ui/app-modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useMatches } from '@/contexts/matches-context';
import { usePlayers } from '@/contexts/players-context';
import type { TennisMatch } from '@/types/match';
import type { Player } from '@/types/player';
import {
  calculatePlayerProgression,
  calculateProgressionBreakdown,
  progressionMetrics,
  progressionPeriods,
  type ProgressionMetric,
  type ProgressionPeriod,
  type ProgressionValue,
} from '@/utils/match-progression';

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' });
const fullDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function MatchProgressionScreen() {
  const { accountId } = useAuth();
  const { playerId } = useLocalSearchParams<{ playerId?: string }>();
  const { matches, isLoadingMatches, matchesLoadFailed, retryLoadMatches } = useMatches();
  const { players } = usePlayers();
  const completedMatches = useMemo(() => matches.filter((match) => match.status === 'Ended'), [matches]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.main}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to matches"
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/matches')}>
            <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Progression</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {isLoadingMatches ? (
            <Text style={styles.note}>Loading saved matches…</Text>
          ) : matchesLoadFailed ? (
            <AppCard style={styles.card}>
              <Text accessibilityRole="alert" style={styles.note}>Could not load match history.</Text>
              <AppButton title="Try again" icon="refresh" onPress={retryLoadMatches} />
            </AppCard>
          ) : completedMatches.length ? (
            <ProgressionHistory
              key={accountId ?? 'guest'}
              matches={completedMatches}
              players={players}
              initialPlayerId={typeof playerId === 'string' ? playerId : undefined}
            />
          ) : (
            <AppCard tone="muted">
              <Text style={styles.note}>Finish a match to see progression.</Text>
            </AppCard>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ProgressionHistory({ matches, players, initialPlayerId }: {
  matches: TennisMatch[];
  players: Player[];
  initialPlayerId?: string;
}) {
  const [playerChoice, setPlayerChoice] = useState(initialPlayerId);
  const [period, setPeriod] = useState<ProgressionPeriod>('last-ten');
  const [metricId, setMetricId] = useState(progressionMetrics[0].id);
  const [picker, setPicker] = useState<'player' | 'period' | 'metric'>();
  const [today, setToday] = useState(() => new Date());
  const [selectedPoint, setSelectedPoint] = useState<string>();

  useFocusEffect(useCallback(() => {
    setToday(new Date());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(new Date());
    });
    return () => subscription.remove();
  }, []));

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const playerOptions = useMemo(() => {
    const ids = new Set(matches.flatMap((match) => [match.player1Id, match.player2Id]));
    return Array.from(ids, (id) => ({ value: id, label: playerName(playerById.get(id)) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [matches, playerById]);
  const selectedPlayer = playerOptions.find(({ value }) => value === playerChoice)
    ?? playerOptions.find(({ value }) => value === matches[0].player1Id) ?? playerOptions[0];
  const playerId = selectedPlayer.value;
  const periodLabel = progressionPeriods.find(({ value }) => value === period)?.label ?? progressionPeriods[0].label;
  const metric = progressionMetrics.find(({ id }) => id === metricId) ?? progressionMetrics[0];
  const sample = useMemo(() => calculatePlayerProgression(matches, playerId, period, today), [matches, playerId, period, today]);
  const labels = metric.kind === 'rate' ? metric.series.map(({ label }) => label) : [metric.label];
  const rows = useMemo(() => buildChartRows(sample, metric, playerById), [sample, metric, playerById]);
  const hasValues = rows.some((row) => row.values.some((value) => value !== null));
  const active = rows.find(({ id }) => id === selectedPoint) ?? (metric.kind === 'breakdown'
    ? rows.reduce<ChartRow | undefined>((best, row) => !best || (row.values[0]?.value ?? 0) > (best.values[0]?.value ?? 0) ? row : best, undefined)
    : rows.findLast((row) => row.values.some((value) => value !== null)));
  const points = rows.map((row) => ({
    id: row.id,
    label: row.axisLabel,
    values: row.values.map((value) => value?.value ?? null),
    accessibilityLabel: [row.title, row.subtitle, ...row.values.map((value, index) =>
      `${labels[index]} ${valueLabel(value, metric.kind)}`)].filter(Boolean).join(', '),
  }));

  return (
    <>
      <View style={styles.controls}>
        <AppButton
          title={selectedPlayer.label}
          accessibilityLabel={`Change player. ${selectedPlayer.label}`}
          icon="person"
          variant="secondary"
          style={styles.control}
          onPress={() => setPicker('player')}
        />
        <AppButton
          title={periodLabel}
          accessibilityLabel={`Change period. ${periodLabel}`}
          icon="event"
          variant="secondary"
          style={styles.control}
          onPress={() => setPicker('period')}
        />
      </View>
      <AppCard style={styles.card}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeading}>
            <Text accessibilityRole="header" style={styles.heading}>{metric.label}</Text>
            <Text style={styles.note}>{sample.length} completed {sample.length === 1 ? 'match' : 'matches'}</Text>
          </View>
          <AppButton title="Stat" accessibilityLabel="Change statistic" icon="tune" variant="secondary" onPress={() => setPicker('metric')} />
        </View>

        {hasValues ? (
          <>
            {labels.length > 1 ? (
              <View style={styles.legend}>
                {labels.map((label, index) => (
                  <View key={label} style={styles.legendItem}>
                    <View style={[styles.swatch, { backgroundColor: progressionSeriesColors[index] }]} />
                    <Text style={styles.note}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <ProgressionChart
              key={`${playerId}:${period}:${metricId}`}
              kind={metric.kind === 'rate' ? 'line' : 'bar'}
              points={points}
              seriesCount={labels.length}
              breakdown={metric.kind === 'breakdown'}
              selectedId={active?.id}
              onSelect={setSelectedPoint}
            />
            {active ? <ChartDetail row={active} labels={labels} kind={metric.kind} /> : null}
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {sample.length ? 'This stat has no recorded data for the selected matches.' : 'No completed matches in this period.'}
          </Text>
        )}
      </AppCard>

      {picker === 'player' ? (
        <ProgressionPicker title="Player" options={playerOptions} value={playerId} onClose={() => setPicker(undefined)}
          onSelect={(id) => { setPlayerChoice(id); setSelectedPoint(undefined); setPicker(undefined); }} />
      ) : null}
      {picker === 'period' ? (
        <ProgressionPicker title="Period" options={progressionPeriods} value={period} onClose={() => setPicker(undefined)}
          onSelect={(value) => { setPeriod(value); setToday(new Date()); setSelectedPoint(undefined); setPicker(undefined); }} />
      ) : null}
      {picker === 'metric' ? (
        <ProgressionPicker title="Statistic" options={progressionMetrics.map(({ id, label }) => ({ value: id, label }))}
          value={metricId} onClose={() => setPicker(undefined)} onSelect={(id) => { setMetricId(id); setPicker(undefined); }} />
      ) : null}
    </>
  );
}

type ChartRow = {
  id: string;
  axisLabel: string;
  title: string;
  subtitle?: string;
  matchId?: string;
  values: (ProgressionValue | null)[];
};

function buildChartRows(
  sample: ReturnType<typeof calculatePlayerProgression>,
  metric: ProgressionMetric,
  playerById: ReadonlyMap<string, Player>,
): ChartRow[] {
  if (metric.kind === 'breakdown') {
    const breakdown = calculateProgressionBreakdown(sample, metric.read);
    const total = breakdown.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return [];
    return breakdown.map(({ label, count }) => ({
      id: label, axisLabel: label, title: label, values: [{ value: count, fraction: { count, attempts: total } }],
    }));
  }

  return sample.map((match) => ({
    id: match.id,
    matchId: match.id,
    axisLabel: formatDate(match.date, shortDate),
    title: `vs ${playerName(playerById.get(match.opponentId))}`,
    subtitle: formatDate(match.date, fullDate),
    values: metric.kind === 'rate' ? metric.series.map((series) => series.read(match)) : [metric.read(match)],
  }));
}

function ChartDetail({ row, labels, kind }: { row: ChartRow; labels: string[]; kind: ProgressionMetric['kind'] }) {
  const matchId = row.matchId;
  return (
    <View style={styles.detail}>
      <View accessibilityLiveRegion="polite" style={styles.detailInfo}>
        <Text style={styles.detailTitle}>{row.title}</Text>
        {row.subtitle ? <Text style={styles.note}>{row.subtitle}</Text> : null}
        {row.values.map((value, index) => (
          <Text key={labels[index]} style={styles.value}>{labels.length > 1 ? `${labels[index]} · ` : ''}{valueLabel(value, kind)}</Text>
        ))}
      </View>
      {matchId ? (
        <AppButton title="Open match" icon="chevron-right" variant="ghost"
          onPress={() => router.push({ pathname: '/match/[id]', params: { id: matchId } })} />
      ) : null}
    </View>
  );
}

function ProgressionPicker<T extends string>({ title, options, value, onSelect, onClose }: {
  title: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onSelect: (next: T) => void;
  onClose: () => void;
}) {
  return (
    <AppModal title={title} visible onClose={onClose}>
      <ScrollView contentContainerStyle={styles.pickerContent}>
        <SegmentedControl options={[...options]} value={value} onChange={onSelect} wrap />
      </ScrollView>
    </AppModal>
  );
}

function valueLabel(value: ProgressionValue | null, kind: ProgressionMetric['kind']) {
  if (!value) return 'No attempts';
  if (kind === 'rate' && value.fraction) return `${value.value}% · ${value.fraction.count}/${value.fraction.attempts}`;
  if (kind === 'breakdown' && value.fraction) return `${value.fraction.count} of ${value.fraction.attempts} recorded`;
  return String(value.value);
}

function formatDate(value: string, formatter: Intl.DateTimeFormat) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? formatter.format(time) : 'Unknown date';
}

function playerName(player: Player | undefined) {
  return player ? `${player.firstName} ${player.lastName}`.trim() : 'Unknown player';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background },
  main: { alignSelf: 'center', flex: 1, maxWidth: 720, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  backButton: {
    alignItems: 'center', borderColor: AppTheme.colors.borderGold, borderRadius: AppTheme.radii.md,
    borderWidth: 1, height: 44, justifyContent: 'center', width: 44,
  },
  title: { color: AppTheme.colors.text, flex: 1, fontSize: 26, fontWeight: '900' },
  content: { gap: 14, padding: 16, paddingTop: 4 },
  card: { gap: 12 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  control: { flexShrink: 1, maxWidth: '100%' },
  chartHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  chartHeading: { flex: 1, gap: 4 },
  heading: { color: AppTheme.colors.text, fontSize: 19, fontWeight: '800' },
  note: { color: AppTheme.colors.textMuted, fontSize: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  swatch: { borderRadius: 5, height: 8, width: 8 },
  detail: {
    alignItems: 'center', borderTopColor: AppTheme.colors.border, borderTopWidth: 1,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', paddingTop: 12,
  },
  detailInfo: { flexGrow: 1, flexShrink: 1, gap: 4 },
  detailTitle: { color: AppTheme.colors.text, fontSize: 16, fontWeight: '800' },
  value: { color: AppTheme.colors.primary, fontSize: 16, fontWeight: '800' },
  pickerContent: { paddingBottom: 2 },
});
