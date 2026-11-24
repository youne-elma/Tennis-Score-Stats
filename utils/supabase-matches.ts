import { requireSupabase } from '@/lib/supabase';
import type { MatchFormValues, ServiceEvent, TennisMatch } from '@/types/match';

type SupabaseMatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  initial_server_id: string;
  number_of_sets: TennisMatch['numberOfSets'];
  games_per_set: TennisMatch['gamesPerSet'];
  use_tiebreaks: boolean;
  tiebreak_type: TennisMatch['tiebreakType'];
  deuce_scoring: TennisMatch['deuceScoring'];
  court_view: TennisMatch['courtView'];
  status: TennisMatch['status'];
  pause_reason: string | null;
  ended_at: string | null;
  created_at: string;
  sync_revision: number;
};

type SupabaseServiceEventRow = {
  id: string;
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

export type CloudMatch = { match: TennisMatch; revision: number };

type SyncResult<Remote> =
  | { status: 'synced'; revision: number }
  | { status: 'conflict'; remote: Remote | null }
  | { status: 'blocked'; reason: 'archived-player' };

export async function loadSupabaseMatches(userId: string, signal?: AbortSignal) {
  const supabase = requireSupabase();
  const matches: CloudMatch[] = [];
  let cursor: SupabaseMatchRow | undefined;
  while (true) {
    const query = supabase.rpc('page_account_matches', {
      p_account_id: userId,
      p_after_created_at: cursor?.created_at ?? null,
      p_after_id: cursor?.id ?? null,
    });
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const page = data as { match_row: SupabaseMatchRow; events: SupabaseServiceEventRow[] }[];
    if (!Array.isArray(page)) throw new Error('Invalid match history result.');
    if (!page.length) return matches.reverse();
    matches.push(...page.map(({ match_row, events }) => fromCloudMatch(match_row, events)));
    cursor = page.at(-1)?.match_row;
  }
}

export async function syncSupabaseMatch(
  userId: string,
  requestId: string,
  revision: number | null,
  match: TennisMatch,
  signal: AbortSignal,
): Promise<SyncResult<CloudMatch>> {
  const { data, error } = await requireSupabase()
    .rpc('sync_account_match', {
      p_account_id: userId,
      p_request_id: requestId,
      p_expected_revision: revision,
      p_match: {
        ...toSupabaseMatchInput(match),
        id: match.id,
        status: match.status,
        pause_reason: match.pauseReason ?? null,
        ended_at: match.endedAt ?? null,
        created_at: match.createdAt,
      },
      p_events: match.serviceEvents.map(toSupabaseServiceEventInput),
    })
    .abortSignal(signal);

  if (error) throw error;
  const result = data as SyncResult<{ match: SupabaseMatchRow; events: SupabaseServiceEventRow[] }>;
  if (result?.status === 'conflict') {
    return { status: 'conflict', remote: result.remote ? fromCloudMatch(result.remote.match, result.remote.events) : null };
  }
  if ((result?.status === 'synced' && Number.isSafeInteger(result.revision)) || result?.status === 'blocked') {
    return result;
  }
  throw new Error('Invalid match sync result.');
}

function fromCloudMatch(row: SupabaseMatchRow, events: SupabaseServiceEventRow[]): CloudMatch {
  return {
    revision: row.sync_revision,
    match: {
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
      serviceEvents: events.map(fromSupabaseServiceEvent),
    },
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

function toSupabaseMatchInput(match: MatchFormValues) {
  return {
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

function toSupabaseServiceEventInput(event: ServiceEvent) {
  return {
    id: event.id,
    created_at: event.createdAt,
    server_id: event.serverId,
    phase: event.phase,
    action: event.action,
    serve_type: event.serveType ?? null,
    zone: event.zone ?? null,
    fault_type: event.faultType ?? null,
    point_winner_id: event.pointWinnerId ?? null,
  };
}
