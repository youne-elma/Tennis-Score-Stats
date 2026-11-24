import type { MatchStatus, TennisMatch } from '@/types/match';

export type MatchHistoryFilters = {
  playerId: string;
  period: 'all' | 'last-seven-days' | 'this-month';
  status: 'all' | MatchStatus;
};

export const defaultMatchHistoryFilters: MatchHistoryFilters = {
  playerId: '',
  period: 'all',
  status: 'all',
};

export function filterMatchHistory(matches: TennisMatch[], filters: MatchHistoryFilters, today: Date) {
  const range = getPeriodRange(filters.period, today);

  return matches.filter((match) => {
    if (filters.playerId && match.player1Id !== filters.playerId && match.player2Id !== filters.playerId) {
      return false;
    }
    if (filters.status !== 'all' && match.status !== filters.status) {
      return false;
    }
    if (!range) {
      return true;
    }

    const date = Date.parse(match.createdAt);
    return date >= range.start && date < range.end;
  });
}

function getPeriodRange(period: MatchHistoryFilters['period'], today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (period === 'last-seven-days') {
    return {
      start: new Date(year, month, day - 6).getTime(),
      end: new Date(year, month, day + 1).getTime(),
    };
  }
  if (period === 'this-month') {
    return {
      start: new Date(year, month, 1).getTime(),
      end: new Date(year, month + 1, 1).getTime(),
    };
  }
}
