import type { MatchStatus, TennisMatch } from '@/types/match';
import { calculateTennisScore } from '@/utils/tennis-score';

export function isResumableStatus(status: MatchStatus | undefined) {
  return status === 'In progress' || status === 'Paused';
}

export function findResumeMatch(matches: TennisMatch[], openedIds: string[]) {
  const openOrder = new Map(openedIds.map((id, index) => [id, index]));
  const candidates = matches.filter((match) => isResumableStatus(match.status));

  candidates.sort((a, b) =>
    (openOrder.get(a.id) ?? openedIds.length) - (openOrder.get(b.id) ?? openedIds.length)
    || lastServiceTime(b) - lastServiceTime(a)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt)
    || a.id.localeCompare(b.id));

  for (const match of candidates) {
    const score = calculateTennisScore(match);
    if (!score.matchWinnerId) {
      return { match, score };
    }
  }
}

function lastServiceTime(match: TennisMatch) {
  return Date.parse(match.serviceEvents.at(-1)?.createdAt ?? match.createdAt);
}
