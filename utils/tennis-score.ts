import { ServiceEvent, TennisMatch } from '@/types/match';

type PlayerScoreState = {
  points: number;
  games: number;
  sets: number;
};

export type TennisScoreState = {
  player1: PlayerScoreState;
  player2: PlayerScoreState;
  completedSets: { player1Games: number; player2Games: number }[];
  currentSetNumber: number;
  currentGameNumber: number;
  pointLabelPlayer1: string;
  pointLabelPlayer2: string;
  totalPointsPlayer1: number;
  totalPointsPlayer2: number;
  currentServerId: string;
  inTiebreak: boolean;
  matchWinnerId?: string;
};

const tennisPointLabels = ['0', '15', '30', '40'];

export function calculateTennisScore(match: TennisMatch): TennisScoreState {
  const state: TennisScoreState = {
    player1: { points: 0, games: 0, sets: 0 },
    player2: { points: 0, games: 0, sets: 0 },
    completedSets: [],
    currentSetNumber: 1,
    currentGameNumber: 1,
    pointLabelPlayer1: '0',
    pointLabelPlayer2: '0',
    totalPointsPlayer1: 0,
    totalPointsPlayer2: 0,
    currentServerId: match.player1Id,
    inTiebreak: false,
  };

  for (const event of match.serviceEvents) {
    const winnerId = getPointWinnerId(event, match);

    if (!winnerId || state.matchWinnerId) {
      continue;
    }

    const winnerKey = winnerId === match.player1Id ? 'player1' : 'player2';
    const loserKey = winnerKey === 'player1' ? 'player2' : 'player1';

    if (winnerKey === 'player1') {
      state.totalPointsPlayer1 += 1;
    } else {
      state.totalPointsPlayer2 += 1;
    }

    if (state.inTiebreak) {
      state[winnerKey].points += 1;
      maybeFinishTiebreak(state, match);
    } else {
      state[winnerKey].points += 1;
      maybeFinishGame(state, winnerKey, loserKey, match);
    }
  }

  refreshDerivedLabels(state, match);

  return state;
}

export function getPointWinnerId(event: ServiceEvent, match: TennisMatch) {
  if (event.action === 'Ace' || event.action === 'Service Winner') {
    return event.serverId;
  }

  if (event.action === 'In Play') {
    return event.pointWinnerId;
  }

  if (event.action === 'Fault' && event.phase === 'Second Serve') {
    return event.serverId === match.player1Id ? match.player2Id : match.player1Id;
  }

  return undefined;
}

function maybeFinishGame(
  state: TennisScoreState,
  winnerKey: 'player1' | 'player2',
  loserKey: 'player1' | 'player2',
  match: TennisMatch
) {
  const winnerPoints = state[winnerKey].points;
  const loserPoints = state[loserKey].points;

  if (match.deuceScoring === 'No-Ad (Short Deuce)' && winnerPoints >= 4) {
    finishGame(state, winnerKey, match);
    return;
  }

  if (winnerPoints >= 4 && winnerPoints - loserPoints >= 2) {
    finishGame(state, winnerKey, match);
  }
}

function finishGame(
  state: TennisScoreState,
  winnerKey: 'player1' | 'player2',
  match: TennisMatch
) {
  state[winnerKey].games += 1;
  state.player1.points = 0;
  state.player2.points = 0;

  maybeFinishSet(state, match);
  refreshDerivedLabels(state, match);
}

function maybeFinishSet(state: TennisScoreState, match: TennisMatch) {
  const targetGames = Number(match.gamesPerSet);
  const player1Games = state.player1.games;
  const player2Games = state.player2.games;

  if (match.useTiebreaks && player1Games === targetGames && player2Games === targetGames) {
    state.inTiebreak = true;
    return;
  }

  if (player1Games >= targetGames && player1Games - player2Games >= 2) {
    finishSet(state, 'player1', match);
    return;
  }

  if (player2Games >= targetGames && player2Games - player1Games >= 2) {
    finishSet(state, 'player2', match);
  }
}

function maybeFinishTiebreak(state: TennisScoreState, match: TennisMatch) {
  const target = match.tiebreakType === 'Standard 7 points' ? 7 : 10;
  const player1Points = state.player1.points;
  const player2Points = state.player2.points;

  if (player1Points >= target && player1Points - player2Points >= 2) {
    state.player1.games += 1;
    finishSet(state, 'player1', match);
    return;
  }

  if (player2Points >= target && player2Points - player1Points >= 2) {
    state.player2.games += 1;
    finishSet(state, 'player2', match);
  }
}

function finishSet(
  state: TennisScoreState,
  winnerKey: 'player1' | 'player2',
  match: TennisMatch
) {
  state.completedSets.push({
    player1Games: state.player1.games,
    player2Games: state.player2.games,
  });
  state[winnerKey].sets += 1;
  state.player1.games = 0;
  state.player2.games = 0;
  state.player1.points = 0;
  state.player2.points = 0;
  state.inTiebreak = false;

  const setsToWin = Math.ceil(Number(match.numberOfSets) / 2);

  if (state[winnerKey].sets >= setsToWin) {
    state.matchWinnerId = winnerKey === 'player1' ? match.player1Id : match.player2Id;
  }
}

function refreshDerivedLabels(state: TennisScoreState, match: TennisMatch) {
  state.currentSetNumber = state.completedSets.length + 1;
  state.currentGameNumber = state.player1.games + state.player2.games + 1;
  state.currentServerId =
    (state.player1.games + state.player2.games) % 2 === 0 ? match.player1Id : match.player2Id;

  if (state.inTiebreak) {
    state.pointLabelPlayer1 = String(state.player1.points);
    state.pointLabelPlayer2 = String(state.player2.points);
    return;
  }

  if (match.deuceScoring === 'Advantage (Long Deuce)' && state.player1.points >= 3 && state.player2.points >= 3) {
    if (state.player1.points === state.player2.points) {
      state.pointLabelPlayer1 = '40';
      state.pointLabelPlayer2 = '40';
    } else if (state.player1.points > state.player2.points) {
      state.pointLabelPlayer1 = 'AD';
      state.pointLabelPlayer2 = '40';
    } else {
      state.pointLabelPlayer1 = '40';
      state.pointLabelPlayer2 = 'AD';
    }
    return;
  }

  state.pointLabelPlayer1 = tennisPointLabels[Math.min(state.player1.points, 3)];
  state.pointLabelPlayer2 = tennisPointLabels[Math.min(state.player2.points, 3)];
}
