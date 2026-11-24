import { createClient } from 'npm:@supabase/supabase-js@2.115.0';

import { processCoachPushDeliveries } from './expo.ts';

const workerSecret = Deno.env.get('COACH_PUSH_WORKER_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!workerSecret || request.headers.get('x-coach-push-secret') !== workerSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Worker is not configured', { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('claim_coach_push_deliveries');

  if (error || !Array.isArray(data)) {
    console.error('Could not claim coach notifications', error?.code);
    return new Response('Could not claim coach notifications', { status: 503 });
  }

  const outcomes = await processCoachPushDeliveries(data, expoAccessToken);
  if (outcomes.length) {
    const { error: finishError } = await supabase.rpc('finish_coach_push_deliveries', { p_results: outcomes });
    if (finishError) {
      console.error('Could not save coach notification results', finishError.code);
      return new Response('Could not save coach notification results', { status: 503 });
    }
  }

  return Response.json({ processed: outcomes.length });
});
