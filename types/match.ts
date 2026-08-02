export type NumberOfSets = '1' | '2' | '3' | '5';

export type GamesPerSet = '4' | '5' | '6';

export type TiebreakType = 'Standard 7 points' | 'Super Tiebreak 10 points' | 'Match Tiebreak';

export type DeuceScoring = 'Advantage (Long Deuce)' | 'No-Ad (Short Deuce)';

export type CourtView = 'Behind Baseline' | 'Side View';

export type MatchStatus = 'Not started' | 'In progress' | 'Paused' | 'Ended';

export type ServePhase = 'First Serve' | 'Second Serve';

export type ServiceAction = 'Fault' | 'Ace' | 'Service Winner' | 'In Play';

export type ServeType = 'Flat' | 'Kick' | 'Slice';

export type ServeZone = 'Down the line' | 'To the body' | 'Wide' | 'T (center)' | 'In the corner';

export type FaultType = 'In the net' | 'Too Long' | 'Too Wide' | 'Outside the T';

export type ServiceEvent = {
  id: string;
  matchId: string;
  serverId: string;
  phase: ServePhase;
  action: ServiceAction;
  serveType?: ServeType;
  zone?: ServeZone;
  faultType?: FaultType;
  pointWinnerId?: string;
  createdAt: string;
};

export type ServiceEventInput = Omit<ServiceEvent, 'id' | 'createdAt'>;

export type TennisMatch = {
  id: string;
  player1Id: string;
  player2Id: string;
  initialServerId: string;
  numberOfSets: NumberOfSets;
  gamesPerSet: GamesPerSet;
  useTiebreaks: boolean;
  tiebreakType: TiebreakType;
  deuceScoring: DeuceScoring;
  courtView: CourtView;
  createdAt: string;
  status: MatchStatus;
  pauseReason?: string;
  endedAt?: string;
  serviceEvents: ServiceEvent[];
};

export type MatchFormValues = Omit<TennisMatch, 'id' | 'createdAt' | 'status' | 'serviceEvents'>;
