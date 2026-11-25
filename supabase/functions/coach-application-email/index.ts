import { createClient } from 'npm:@supabase/supabase-js@2.115.0';

type EmailJob = {
  application_id: string;
  attempts: number;
  full_name: string;
  club: string | null;
  experience: string;
  motivation: string;
};

const workerSecret = Deno.env.get('COACH_APPLICATION_WORKER_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const apiKey = Deno.env.get('RESEND_API_KEY');
const sender = Deno.env.get('COACH_APPLICATION_FROM');
const recipient = Deno.env.get('COACH_APPLICATION_TO');
const reviewUrl = readReviewUrl(Deno.env.get('COACH_APPLICATION_REVIEW_URL'));

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!workerSecret || request.headers.get('x-coach-application-secret') !== workerSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!supabaseUrl || !serviceRoleKey || !apiKey || !sender || !recipient || !reviewUrl) {
    return new Response('Email worker is not configured', { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('claim_coach_application_emails');
  if (error || !Array.isArray(data)) {
    console.error('Could not claim coach application emails', error?.code);
    return new Response('Could not claim application emails', { status: 503 });
  }

  const jobs = data as EmailJob[];
  const results = [];
  for (const job of jobs) {
    const result = await sendEmail(job, { apiKey, sender, recipient, reviewUrl });
    results.push({ application_id: job.application_id, attempts: job.attempts, ...result });
  }
  if (results.length) {
    const { error: finishError } = await supabase.rpc('finish_coach_application_emails', { p_results: results });
    if (finishError) {
      console.error('Could not save coach application email results', finishError.code);
      return new Response('Could not save application email results', { status: 503 });
    }
  }
  return Response.json({ processed: results.length });
});

function readReviewUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url;
  } catch {
    // A malformed setting is reported before any email is claimed.
  }
}

async function sendEmail(
  application: EmailJob,
  settings: { apiKey: string; sender: string; recipient: string; reviewUrl: URL },
) {
  const link = new URL(settings.reviewUrl);
  link.searchParams.set('applicationId', application.application_id);
  const text = [
    application.full_name + ' a envoyé une candidature pour devenir coach sur Tennis Score Stats.',
    ...(application.club ? ['Club : ' + application.club] : []),
    'Expérience\n' + application.experience,
    'Motivation\n' + application.motivation,
    'Consulter la candidature\n' + link.href,
  ].join('\n\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + settings.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'coach-application/' + application.application_id,
      },
      body: JSON.stringify({
        from: settings.sender,
        to: [settings.recipient],
        subject: 'Nouvelle candidature coach · Tennis Score Stats',
        text,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return {
        error_code: 'ResendHTTP' + response.status,
        retry: response.status === 429 || response.status === 409 || response.status >= 500,
      };
    }
    return { error_code: null, retry: false };
  } catch {
    return { error_code: 'ResendUnavailable', retry: true };
  }
}
