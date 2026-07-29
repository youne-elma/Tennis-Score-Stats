import { FaultType, ServiceEvent, ServeType, ServeZone, TennisMatch } from '@/types/match';
import { calculateTennisScore, getPointWinnerId, TennisScoreState } from '@/utils/tennis-score';

export type PlayerMatchStats = {
  playerId: string;
  pointsWon: number;
  pointsWinPercentage: number;
  firstServeAttempts: number;
  firstServesIn: number;
  firstServePercentage: number;
  aces: number;
  serviceWinners: number;
  faults: number;
  doubleFaults: number;
  firstServePointsWon: number;
  firstServePointsPlayed: number;
  firstServePointsWonPercentage: number;
  secondServePointsWon: number;
  secondServePointsPlayed: number;
  secondServePointsWonPercentage: number;
  breakPoints: number;
  breakPointsWon: number;
  breakPointsWonPercentage: number;
  byServeType: Record<ServeType, ServiceBreakdown>;
  byZone: Record<ServeZone, ServiceBreakdown>;
  byFaultType: Record<FaultType, number>;
};

export type ServiceBreakdown = {
  attempts: number;
  pointsWon: number;
  successPercentage: number;
  pointsWonPercentage: number;
};

export type MatchStats = {
  player1: PlayerMatchStats;
  player2: PlayerMatchStats;
  totalPoints: number;
};

export function calculateMatchStats(match: TennisMatch): MatchStats {
  const player1 = createPlayerStats(match.player1Id);
  const player2 = createPlayerStats(match.player2Id);
  const byPlayerId = new Map([
    [match.player1Id, player1],
    [match.player2Id, player2],
  ]);

  let totalPoints = 0;
  const eventsBeforePoint: ServiceEvent[] = [];

  for (const event of match.serviceEvents) {
    const serverStats = byPlayerId.get(event.serverId);

    if (!serverStats) {
      continue;
    }

    if (event.phase === 'First Serve') {
      serverStats.firstServeAttempts += 1;
    }

    if (event.action === 'Fault') {
      serverStats.faults += 1;

      if (event.faultType) {
        serverStats.byFaultType[event.faultType] += 1;
      }
    }

    if (event.action === 'Ace') {
      serverStats.aces += 1;
    }

    if (event.action === 'Service Winner') {
      serverStats.serviceWinners += 1;
    }

    const pointWinnerId = getPointWinnerId(event, match);

    if (!pointWinnerId) {
      trackServiceBreakdown(serverStats, event, false);
      eventsBeforePoint.push(event);
      continue;
    }

    const scoreBeforePoint = calculateTennisScore({
      ...match,
      serviceEvents: eventsBeforePoint,
    });
    const receiverId = event.serverId === match.player1Id ? match.player2Id : match.player1Id;
    const receiverStats = byPlayerId.get(receiverId)!;
    const isBreakPoint = hasBreakPointChance(scoreBeforePoint, match, receiverId);

    if (isBreakPoint) {
      receiverStats.breakPoints += 1;

      if (pointWinnerId === receiverId) {
        receiverStats.breakPointsWon += 1;
      }
    }

    totalPoints += 1;
    byPlayerId.get(pointWinnerId)!.pointsWon += 1;
    trackServiceBreakdown(serverStats, event, pointWinnerId === event.serverId);

    if (event.phase === 'First Serve') {
      serverStats.firstServesIn += 1;
      serverStats.firstServePointsPlayed += 1;

      if (pointWinnerId === event.serverId) {
        serverStats.firstServePointsWon += 1;
      }
    } else {
      serverStats.secondServePointsPlayed += 1;

      if (pointWinnerId === event.serverId) {
        serverStats.secondServePointsWon += 1;
      }

      if (event.action === 'Fault') {
        serverStats.doubleFaults += 1;
      }
    }

    eventsBeforePoint.push(event);
  }

  finalizeStats(player1, totalPoints);
  finalizeStats(player2, totalPoints);

  return {
    player1,
    player2,
    totalPoints,
  };
}

function createPlayerStats(playerId: string): PlayerMatchStats {
  return {
    playerId,
    pointsWon: 0,
    pointsWinPercentage: 0,
    firstServeAttempts: 0,
    firstServesIn: 0,
    firstServePercentage: 0,
    aces: 0,
    serviceWinners: 0,
    faults: 0,
    doubleFaults: 0,
    firstServePointsWon: 0,
    firstServePointsPlayed: 0,
    firstServePointsWonPercentage: 0,
    secondServePointsWon: 0,
    secondServePointsPlayed: 0,
    secondServePointsWonPercentage: 0,
    breakPoints: 0,
    breakPointsWon: 0,
    breakPointsWonPercentage: 0,
    byServeType: createServeTypeBreakdown(),
    byZone: createZoneBreakdown(),
    byFaultType: {
      'In the net': 0,
      'Too Long': 0,
      'Too Wide': 0,
      'Outside the T': 0,
    },
  };
}

function finalizeStats(stats: PlayerMatchStats, totalPoints: number) {
  stats.pointsWinPercentage = percentage(stats.pointsWon, totalPoints);
  stats.firstServePercentage = percentage(stats.firstServesIn, stats.firstServeAttempts);
  stats.firstServePointsWonPercentage = percentage(stats.firstServePointsWon, stats.firstServePointsPlayed);
  stats.secondServePointsWonPercentage = percentage(stats.secondServePointsWon, stats.secondServePointsPlayed);
  stats.breakPointsWonPercentage = percentage(stats.breakPointsWon, stats.breakPoints);
  finalizeBreakdown(stats.byServeType);
  finalizeBreakdown(stats.byZone);
}

function percentage(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function hasBreakPointChance(score: TennisScoreState, match: TennisMatch, receiverId: string) {
  if (score.inTiebreak) {
    return false;
  }

  const receiverKey = receiverId === match.player1Id ? 'player1' : 'player2';
  const serverKey = receiverKey === 'player1' ? 'player2' : 'player1';
  const receiverPointsAfterWinning = score[receiverKey].points + 1;
  const serverPoints = score[serverKey].points;

  if (match.deuceScoring === 'No-Ad (Short Deuce)') {
    return receiverPointsAfterWinning >= 4;
  }

  return receiverPointsAfterWinning >= 4 && receiverPointsAfterWinning - serverPoints >= 2;
}

function trackServiceBreakdown(stats: PlayerMatchStats, event: ServiceEvent, pointWon: boolean) {
  if (event.serveType) {
    stats.byServeType[event.serveType].attempts += 1;

    if (event.action !== 'Fault') {
      stats.byServeType[event.serveType].successPercentage += 1;
    }

    if (pointWon) {
      stats.byServeType[event.serveType].pointsWon += 1;
    }
  }

  if (event.zone) {
    stats.byZone[event.zone].attempts += 1;

    if (event.action !== 'Fault') {
      stats.byZone[event.zone].successPercentage += 1;
    }

    if (pointWon) {
      stats.byZone[event.zone].pointsWon += 1;
    }
  }
}

function finalizeBreakdown<T extends string>(breakdown: Record<T, ServiceBreakdown>) {
  for (const key of Object.keys(breakdown) as T[]) {
    const item = breakdown[key];
    item.successPercentage = percentage(item.successPercentage, item.attempts);
    item.pointsWonPercentage = percentage(item.pointsWon, item.attempts);
  }
}

function createEmptyBreakdown(): ServiceBreakdown {
  return {
    attempts: 0,
    pointsWon: 0,
    successPercentage: 0,
    pointsWonPercentage: 0,
  };
}

function createServeTypeBreakdown(): Record<ServeType, ServiceBreakdown> {
  return {
    Flat: createEmptyBreakdown(),
    Kick: createEmptyBreakdown(),
    Slice: createEmptyBreakdown(),
  };
}

function createZoneBreakdown(): Record<ServeZone, ServiceBreakdown> {
  return {
    'Down the line': createEmptyBreakdown(),
    'To the body': createEmptyBreakdown(),
    Wide: createEmptyBreakdown(),
    'T (center)': createEmptyBreakdown(),
    'In the corner': createEmptyBreakdown(),
  };
}
