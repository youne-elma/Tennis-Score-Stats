import type { TennisScoreState } from '@/utils/tennis-score';
import type { MatchStatsSummaryRow } from '@/utils/tennis-stats';

export type SharedMatchStats = {
  player1Name: string;
  player2Name: string;
  score: string;
  summary: MatchStatsSummaryRow[];
  details: string;
};

export function formatSharedMatchScore(score: TennisScoreState) {
  const setScores = score.completedSets.map(({ player1Games, player2Games }) => `${player1Games}–${player2Games}`);
  const hasCurrentPoints = score.player1.points > 0 || score.player2.points > 0;
  const hasCurrentSet = score.player1.games > 0 || score.player2.games > 0 || hasCurrentPoints;

  if (!score.matchWinnerId && (setScores.length === 0 || hasCurrentSet)) {
    const currentGames = `${score.player1.games}–${score.player2.games}`;
    const currentPoints = hasCurrentPoints ? ` (${score.pointLabelPlayer1}–${score.pointLabelPlayer2})` : '';
    setScores.push(currentGames + currentPoints);
  }

  return setScores.join(' · ');
}

export function readSharedMatchStats(value: unknown): SharedMatchStats | undefined {
  if (!value || typeof value !== 'object') {
    return;
  }

  const { player1Name, player2Name, score, summary, details } = value as Partial<SharedMatchStats>;
  if (
    typeof player1Name === 'string' &&
    typeof player2Name === 'string' &&
    typeof score === 'string' &&
    typeof details === 'string' &&
    Array.isArray(summary) &&
    summary.every(isSummaryRow)
  ) {
    return { player1Name, player2Name, score, summary, details };
  }
}

function isSummaryRow(value: unknown): value is MatchStatsSummaryRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const { label, player1Value, player2Value } = value as Partial<MatchStatsSummaryRow>;
  return typeof label === 'string' && typeof player1Value === 'string' && typeof player2Value === 'string';
}
