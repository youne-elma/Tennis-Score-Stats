import { requireSupabase } from '@/lib/supabase';

export type ApplicationDecision = 'approved' | 'rejected';

export type CoachApplicationForm = {
  fullName: string;
  club: string;
  experience: string;
  motivation: string;
};

type CoachApplicationRow = {
  id: string;
  full_name: string;
  club: string | null;
  experience: string;
  motivation: string;
  status: 'pending' | ApplicationDecision;
  created_at: string;
  reviewed_at: string | null;
};

const applicationColumns = 'id,full_name,club,experience,motivation,status,created_at,reviewed_at';
const pageSize = 100;

export function isCoachApplicationId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function loadMyCoachApplication(userId: string) {
  const { data, error } = await requireSupabase()
    .from('coach_applications')
    .select(applicationColumns)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as CoachApplicationRow) : null;
}

export async function loadCoachApplications(applicationId?: string) {
  const supabase = requireSupabase();
  if (applicationId) {
    const { data, error } = await supabase
      .from('coach_applications')
      .select(applicationColumns)
      .eq('id', applicationId)
      .maybeSingle();
    if (error) throw error;
    return data ? [fromRow(data as CoachApplicationRow)] : [];
  }

  const rows: CoachApplicationRow[] = [];
  let cursor: CoachApplicationRow | undefined;
  while (true) {
    const query = supabase
      .from('coach_applications')
      .select(applicationColumns)
      .eq('status', 'pending')
      .order('created_at')
      .order('id')
      .limit(pageSize);

    if (cursor) {
      const timestamp = '"' + cursor.created_at + '"';
      query.or('created_at.gt.' + timestamp + ',and(created_at.eq.' + timestamp + ',id.gt.' + cursor.id + ')');
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return rows.map(fromRow);
    const page = data as CoachApplicationRow[];
    rows.push(...page);
    cursor = page.at(-1);
  }
}

export async function submitCoachApplication(form: CoachApplicationForm) {
  const { data, error } = await requireSupabase().rpc('submit_coach_application', {
    p_full_name: form.fullName.trim(),
    p_club: form.club.trim() || null,
    p_experience: form.experience.trim(),
    p_motivation: form.motivation.trim(),
  });
  if (error) throw error;
  return fromMutation(data);
}

export async function reviewCoachApplication(applicationId: string, decision: ApplicationDecision) {
  const { data, error } = await requireSupabase().rpc('review_coach_application', {
    p_application_id: applicationId,
    p_decision: decision,
  });
  if (error) throw error;
  return fromMutation(data);
}

function fromMutation(data: CoachApplicationRow | CoachApplicationRow[] | null) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) throw new Error('Application unavailable.');
  return fromRow(row);
}

function fromRow(row: CoachApplicationRow) {
  return {
    id: row.id,
    fullName: row.full_name,
    club: row.club ?? '',
    experience: row.experience,
    motivation: row.motivation,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export type CoachApplication = ReturnType<typeof fromRow>;
