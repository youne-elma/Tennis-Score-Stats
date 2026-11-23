import { requireSupabase } from '@/lib/supabase';
import { Player, PlayerFormValues } from '@/types/player';

type SupabasePlayerRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  gender: Player['gender'];
  handedness: Player['handedness'];
  birthday_date: string;
  strengths: string | null;
  weaknesses: string | null;
  photo_url: string | null;
  archived_at: string | null;
};

const playerSelect = 'id,user_id,first_name,last_name,gender,handedness,birthday_date,strengths,weaknesses,photo_url,archived_at';

export async function loadSupabasePlayers(userId: string) {
  const { data, error } = await requireSupabase()
    .from('players')
    .select(playerSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabasePlayer);
}

export async function createSupabasePlayer(userId: string, player: PlayerFormValues) {
  const { data, error } = await requireSupabase()
    .from('players')
    .insert(toSupabasePlayerInput(userId, player))
    .select(playerSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabasePlayer(data);
}

export async function updateSupabasePlayer(id: string, userId: string, player: PlayerFormValues) {
  const { data, error } = await requireSupabase()
    .from('players')
    .update(toSupabasePlayerInput(userId, player))
    .eq('id', id)
    .eq('user_id', userId)
    .select(playerSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabasePlayer(data);
}

export async function archiveSupabasePlayer(id: string, userId: string, archivedAt: string) {
  const { data, error } = await requireSupabase()
    .from('players')
    .update({ archived_at: archivedAt })
    .eq('id', id)
    .eq('user_id', userId)
    .select(playerSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabasePlayer(data);
}

export async function syncLocalPlayersToSupabase(userId: string, players: Player[]) {
  const rows = players
    .filter((player) => !player.archivedAt)
    .map((player) => {
      const id = normalizeUuid(player.id);
      const row = toSupabasePlayerInput(userId, player);

      return id ? { id, ...row } : row;
    });

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('players')
    .upsert(rows, { onConflict: 'id' })
    .select(playerSelect);

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabasePlayer);
}

function fromSupabasePlayer(row: SupabasePlayerRow): Player {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    handedness: row.handedness,
    birthdayDate: row.birthday_date,
    strengths: row.strengths ?? undefined,
    weaknesses: row.weaknesses ?? undefined,
    photoUri: row.photo_url ?? undefined,
    archivedAt: row.archived_at ?? undefined,
  };
}

function toSupabasePlayerInput(userId: string, player: PlayerFormValues) {
  return {
    user_id: userId,
    first_name: player.firstName,
    last_name: player.lastName,
    gender: player.gender,
    handedness: player.handedness,
    birthday_date: player.birthdayDate,
    strengths: normalizeOptionalText(player.strengths),
    weaknesses: normalizeOptionalText(player.weaknesses),
    photo_url: normalizeOptionalText(player.photoUri),
  };
}

function normalizeOptionalText(value?: string) {
  const nextValue = value?.trim();

  return nextValue ? nextValue : null;
}

function normalizeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}
