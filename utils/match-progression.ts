import type { TennisMatch } from '@/types/match';
import { getPeriodRange } from '@/utils/match-history-filters';
import { calculateMatchStats, type PlayerMatchStats } from '@/utils/tennis-stats';

export const progressionPeriods = [
  { value: 'last-ten', label: 'Last 10 matches' },
  { value: 'last-thirty', label: 'Last 30 matches' },
  { value: 'last-seven-days', label: 'Last 7 days' },
  { value: 'this-month', label: 'This month' },
] as const;

export type ProgressionPeriod = (typeof progressionPeriods)[number]['value'];

export type ProgressionValue = {
  value: number;
  fraction?: { count: number; attempts: number };
};

export type ProgressionMatch = {
  id: string;
  date: string;
  opponentId: string;
  stats: PlayerMatchStats;
  totalPoints: number;
};

type RateSeries = {
  label: string;
  read: (match: ProgressionMatch) => ProgressionValue | null;
};

type MetricDefinition = { id: string; label: string } & (
  | { kind: 'rate'; series: RateSeries[] }
  | { kind: 'count'; read: (match: ProgressionMatch) => ProgressionValue | null }
  | { kind: 'breakdown'; read: (stats: PlayerMatchStats) => Record<string, number> }
);

export const progressionMetrics = [
  {
    id: 'first-serve', label: 'First serves in', kind: 'rate',
    series: [{ label: 'First serves in', read: ({ stats }) => rate(stats.firstServePercentage, stats.firstServesIn, stats.firstServeAttempts) }],
  },
  {
    id: 'serve-points', label: 'Service points won', kind: 'rate',
    series: [
      { label: 'First serve', read: ({ stats }) => rate(stats.firstServePointsWonPercentage, stats.firstServePointsWon, stats.firstServePointsPlayed) },
      { label: 'Second serve', read: ({ stats }) => rate(stats.secondServePointsWonPercentage, stats.secondServePointsWon, stats.secondServePointsPlayed) },
    ],
  },
  { id: 'aces', label: 'Aces', kind: 'count', read: ({ stats }) => serveCount(stats, stats.aces) },
  { id: 'service-winners', label: 'Service winners', kind: 'count', read: ({ stats }) => serveCount(stats, stats.serviceWinners) },
  { id: 'faults', label: 'Faults', kind: 'count', read: ({ stats }) => serveCount(stats, stats.faults) },
  { id: 'double-faults', label: 'Double faults', kind: 'count', read: ({ stats }) => serveCount(stats, stats.doubleFaults) },
  {
    id: 'points', label: 'Points won', kind: 'count',
    read: ({ stats, totalPoints }) => totalPoints > 0 ? { value: stats.pointsWon } : null,
  },
  {
    id: 'points-rate', label: 'Points won (%)', kind: 'rate',
    series: [{ label: 'Points won', read: ({ stats, totalPoints }) => rate(stats.pointsWinPercentage, stats.pointsWon, totalPoints) }],
  },
  {
    id: 'break-points', label: 'Break points converted', kind: 'rate',
    series: [{ label: 'Break points converted', read: ({ stats }) => rate(stats.breakPointsWonPercentage, stats.breakPointsWon, stats.breakPoints) }],
  },
  {
    id: 'serve-types', label: 'Serve types', kind: 'breakdown',
    read: ({ byServeType }) => attemptsByCategory(byServeType),
  },
  {
    id: 'placement', label: 'Placement zones', kind: 'breakdown',
    read: ({ byZone }) => attemptsByCategory(byZone),
  },
  {
    id: 'fault-types', label: 'Fault types', kind: 'breakdown',
    read: ({ byFaultType }) => byFaultType,
  },
] satisfies MetricDefinition[];

export type ProgressionMetric = (typeof progressionMetrics)[number];

export function calculatePlayerProgression(
  matches: readonly TennisMatch[], playerId: string, period: ProgressionPeriod, today: Date,
): ProgressionMatch[] {
  const limit = period === 'last-ten' ? 10 : 30;
  const range = period === 'last-ten' || period === 'last-thirty' ? undefined : getPeriodRange(period, today);
  const completed = matches
    .filter((match) => match.status === 'Ended' && (match.player1Id === playerId || match.player2Id === playerId))
    .map((match) => {
      const date = match.endedAt ?? match.createdAt;
      return { match, date, time: Date.parse(date) };
    })
    .filter(({ time }) => !range || (time >= range.start && time < range.end))
    .sort((a, b) => a.time - b.time || a.match.id.localeCompare(b.match.id));

  return (range ? completed : completed.slice(-limit)).map(({ match, date }) => {
    const { player1, player2, totalPoints } = calculateMatchStats(match);
    const representedByPlayer1 = match.player1Id === playerId;
    return {
      id: match.id,
      date,
      opponentId: representedByPlayer1 ? match.player2Id : match.player1Id,
      stats: representedByPlayer1 ? player1 : player2,
      totalPoints,
    };
  });
}

export function calculateProgressionBreakdown(matches: readonly ProgressionMatch[], read: (stats: PlayerMatchStats) => Record<string, number>) {
  const totals = new Map<string, number>();
  for (const match of matches) {
    for (const [label, count] of Object.entries(read(match.stats))) {
      totals.set(label, (totals.get(label) ?? 0) + count);
    }
  }
  return Array.from(totals, ([label, count]) => ({ label, count }));
}

function rate(value: number, count: number, attempts: number): ProgressionValue | null {
  return attempts > 0 ? { value, fraction: { count, attempts } } : null;
}

function serveCount(stats: PlayerMatchStats, count: number): ProgressionValue | null {
  return stats.firstServeAttempts + stats.secondServePointsPlayed > 0 ? { value: count } : null;
}

function attemptsByCategory(categories: Record<string, { attempts: number }>) {
  return Object.fromEntries(Object.entries(categories).map(([label, stats]) => [label, stats.attempts]));
}
