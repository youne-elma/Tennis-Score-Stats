import { supabase } from '@/lib/supabase';
import {
  DeuceScoring,
  GamesPerSet,
  MatchFormValues,
  MatchStatus,
  NumberOfSets,
  ServiceEvent,
  ServiceEventInput,
  TennisMatch,
} from '@/types/match';

type SupabaseMatchRow = {
  id: string;
  user_id: string;
  player1_id: string;
  player2_id: string;
  initial_server_id: string;
  number_of_sets: NumberOfSets;
  games_per_set: GamesPerSet;
  use_tiebreaks: boolean;
  tiebreak_type: TennisMatch['tiebreakType'];
  deuce_scoring: DeuceScoring;
  court_view: TennisMatch['courtView'];
  status: MatchStatus;
  pause_reason: string | null;
  ended_at: string | null;
  created_at: string;
};

type SupabaseServiceEventRow = {
  id: string;
  user_id: string;
  match_id: string;
  server_id: string;
  phase: ServiceEvent['phase'];
  action: ServiceEvent['action'];
  serve_type: ServiceEvent['serveType'] | null;
  zone: ServiceEvent['zone'] | null;
  fault_type: ServiceEvent['faultType'] | null;
  point_winner_id: string | null;
  created_at: string;
};

const matchSelect =
  'id,user_id,player1_id,player2_id,initial_server_id,number_of_sets,games_per_set,use_tiebreaks,tiebreak_type,deuce_scoring,court_view,status,pause_reason,ended_at,created_at';

const serviceEventSelect =
  'id,user_id,match_id,server_id,phase,action,serve_type,zone,fault_type,point_winner_id,created_at';

export async function loadSupabaseMatches(userId: string) {
  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select(matchSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (matchesError) {
    throw matchesError;
  }

  const matches = (matchRows ?? []).map((row) => fromSupabaseMatch(row, []));
  const matchIds = matches.map((match) => match.id);

  if (matchIds.length === 0) {
    return matches;
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from('service_events')
    .select(serviceEventSelect)
    .in('match_id', matchIds)
    .order('created_at', { ascending: true });

  if (eventsError) {
    throw eventsError;
  }

  const eventsByMatchId = new Map<string, ServiceEvent[]>();

  for (const row of eventRows ?? []) {
    const events = eventsByMatchId.get(row.match_id) ?? [];
    events.push(fromSupabaseServiceEvent(row));
    eventsByMatchId.set(row.match_id, events);
  }

  return matches.map((match) => ({
    ...match,
    serviceEvents: eventsByMatchId.get(match.id) ?? [],
  }));
}

export async function createSupabaseMatch(userId: string, match: MatchFormValues) {
  const { data, error } = await supabase
    .from('matches')
    .insert(toSupabaseMatchInput(userId, match))
    .select(matchSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseMatch(data, []);
}

export async function updateSupabaseMatch(id: string, userId: string, match: Partial<MatchFormValues> & Partial<TennisMatch>) {
  const { data, error } = await supabase
    .from('matches')
    .update(toSupabaseMatchUpdate(match))
    .eq('id', id)
    .eq('user_id', userId)
    .select(matchSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseMatch(data, []);
}

export async function createSupabaseServiceEvent(userId: string, event: ServiceEventInput) {
  const { data, error } = await supabase
    .from('service_events')
    .insert(toSupabaseServiceEventInput(userId, event))
    .select(serviceEventSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseServiceEvent(data);
}

export async function updateSupabaseServiceEvent(
  matchId: string,
  eventId: string,
  userId: string,
  event: Partial<ServiceEvent>
) {
  const { data, error } = await supabase
    .from('service_events')
    .update(toSupabaseServiceEventUpdate(event))
    .eq('id', eventId)
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .select(serviceEventSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseServiceEvent(data);
}

export async function deleteSupabaseServiceEvent(matchId: string, eventId: string, userId: string) {
  const { error } = await supabase
    .from('service_events')
    .delete()
    .eq('id', eventId)
    .eq('match_id', matchId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

function fromSupabaseMatch(row: SupabaseMatchRow, serviceEvents: ServiceEvent[]): TennisMatch {
  return {
    id: row.id,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    initialServerId: row.initial_server_id,
    numberOfSets: row.number_of_sets,
    gamesPerSet: row.games_per_set,
    useTiebreaks: row.use_tiebreaks,
    tiebreakType: row.tiebreak_type,
    deuceScoring: row.deuce_scoring,
    courtView: row.court_view,
    createdAt: row.created_at,
    status: row.status,
    pauseReason: row.pause_reason ?? undefined,
    endedAt: row.ended_at ?? undefined,
    serviceEvents,
  };
}

function fromSupabaseServiceEvent(row: SupabaseServiceEventRow): ServiceEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    serverId: row.server_id,
    phase: row.phase,
    action: row.action,
    serveType: row.serve_type ?? undefined,
    zone: row.zone ?? undefined,
    faultType: row.fault_type ?? undefined,
    pointWinnerId: row.point_winner_id ?? undefined,
    createdAt: row.created_at,
  };
}

function toSupabaseMatchInput(userId: string, match: MatchFormValues) {
  return {
    user_id: userId,
    player1_id: match.player1Id,
    player2_id: match.player2Id,
    initial_server_id: match.initialServerId,
    number_of_sets: match.numberOfSets,
    games_per_set: match.gamesPerSet,
    use_tiebreaks: match.useTiebreaks,
    tiebreak_type: match.tiebreakType,
    deuce_scoring: match.deuceScoring,
    court_view: match.courtView,
  };
}

function toSupabaseMatchUpdate(match: Partial<MatchFormValues> & Partial<TennisMatch>) {
  const row: Record<string, unknown> = {};

  setIfPresent(row, match, 'player1Id', 'player1_id');
  setIfPresent(row, match, 'player2Id', 'player2_id');
  setIfPresent(row, match, 'initialServerId', 'initial_server_id');
  setIfPresent(row, match, 'numberOfSets', 'number_of_sets');
  setIfPresent(row, match, 'gamesPerSet', 'games_per_set');
  setIfPresent(row, match, 'useTiebreaks', 'use_tiebreaks');
  setIfPresent(row, match, 'tiebreakType', 'tiebreak_type');
  setIfPresent(row, match, 'deuceScoring', 'deuce_scoring');
  setIfPresent(row, match, 'courtView', 'court_view');
  setIfPresent(row, match, 'status', 'status');
  setIfPresent(row, match, 'pauseReason', 'pause_reason');
  setIfPresent(row, match, 'endedAt', 'ended_at');

  return row;
}

function toSupabaseServiceEventInput(userId: string, event: ServiceEventInput) {
  return {
    user_id: userId,
    match_id: event.matchId,
    server_id: event.serverId,
    phase: event.phase,
    action: event.action,
    serve_type: event.serveType ?? null,
    zone: event.zone ?? null,
    fault_type: event.faultType ?? null,
    point_winner_id: event.pointWinnerId ?? null,
  };
}

function toSupabaseServiceEventUpdate(event: Partial<ServiceEvent>) {
  const row: Record<string, unknown> = {};

  setIfPresent(row, event, 'serverId', 'server_id');
  setIfPresent(row, event, 'phase', 'phase');
  setIfPresent(row, event, 'action', 'action');
  setIfPresent(row, event, 'serveType', 'serve_type');
  setIfPresent(row, event, 'zone', 'zone');
  setIfPresent(row, event, 'faultType', 'fault_type');
  setIfPresent(row, event, 'pointWinnerId', 'point_winner_id');

  return row;
}

function setIfPresent<T extends Record<string, unknown>>(
  row: Record<string, unknown>,
  source: T,
  sourceKey: keyof T,
  rowKey: string
) {
  if (Object.prototype.hasOwnProperty.call(source, sourceKey)) {
    row[rowKey] = source[sourceKey] ?? null;
  }
}
