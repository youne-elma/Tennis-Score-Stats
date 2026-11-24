type CoachPushDelivery = {
  id: string;
  state: 'pending' | 'submitted';
  attempts: number;
  expo_token: string;
  recipient_id: string;
  thread_id: string;
  ticket_id: string | null;
};

type Outcome = {
  state: 'pending' | 'submitted' | 'sent' | 'failed';
  available_at?: string;
  ticket_id?: string;
  last_error?: string;
};

type ExpoResult =
  | { ok: true; data: unknown }
  | { ok: false; retry: boolean; code: string };

const expoPushUrl = 'https://exp.host/--/api/v2/push';
const receiptDelayMs = 15 * 60_000;

async function callExpo(endpoint: string, body: unknown, accessToken?: string): Promise<ExpoResult> {
  try {
    const response = await fetch(expoPushUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        retry: response.status === 429 || response.status >= 500,
        code: 'ExpoHTTP' + response.status,
      };
    }

    const result: { data?: unknown } = await response.json();
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, retry: true, code: 'ExpoUnavailable' };
  }
}

function retry(delivery: CoachPushDelivery, code: string): Outcome {
  const delayMs = Math.min(30_000 * 2 ** (delivery.attempts - 1), receiptDelayMs);
  return {
    state: delivery.state,
    available_at: new Date(Date.now() + delayMs).toISOString(),
    last_error: code,
  };
}

function failed(code: string): Outcome {
  return { state: 'failed', last_error: code };
}

function expoError(value: unknown) {
  if (value && typeof value === 'object' && 'details' in value) {
    const details = value.details;
    if (details && typeof details === 'object' && 'error' in details && typeof details.error === 'string') {
      return /^[A-Za-z][A-Za-z0-9_]*$/.test(details.error) ? details.error.slice(0, 64) : 'ExpoRejected';
    }
  }

  return 'ExpoRejected';
}

function record(delivery: CoachPushDelivery, outcome: Outcome) {
  return { id: delivery.id, claimed_state: delivery.state, attempts: delivery.attempts, ...outcome };
}

async function sendPushes(deliveries: CoachPushDelivery[], accessToken?: string) {
  if (!deliveries.length) {
    return [];
  }

  const response = await callExpo('/send', deliveries.map((delivery) => ({
    to: delivery.expo_token,
    title: 'Coach Chat',
    body: 'Your coach replied.',
    sound: 'default',
    channelId: 'coach-replies',
    data: { type: 'coach-reply', threadId: delivery.thread_id, recipientId: delivery.recipient_id },
  })), accessToken);

  if (!response.ok) {
    return deliveries.map((delivery) => record(delivery, response.retry ? retry(delivery, response.code) : failed(response.code)));
  }

  const tickets = response.data;
  if (!Array.isArray(tickets) || tickets.length !== deliveries.length) {
    return deliveries.map((delivery) => record(delivery, retry(delivery, 'MissingPushTickets')));
  }

  return deliveries.map((delivery, index) => {
    const ticket = tickets[index];
    if (ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id) {
      return record(delivery, {
        state: 'submitted',
        ticket_id: ticket.id,
        available_at: new Date(Date.now() + receiptDelayMs).toISOString(),
      });
    }

    const code = expoError(ticket);
    return record(delivery, code === 'MessageRateExceeded' ? retry(delivery, code) : failed(code));
  });
}

async function checkReceipts(deliveries: CoachPushDelivery[], accessToken?: string) {
  if (!deliveries.length) {
    return [];
  }

  const ids = deliveries.flatMap((delivery) => delivery.ticket_id ? [delivery.ticket_id] : []);
  const response = ids.length ? await callExpo('/getReceipts', { ids }, accessToken) : null;

  return deliveries.map((delivery) => {
    if (!delivery.ticket_id || !response) {
      return record(delivery, failed('MissingTicketId'));
    }
    if (!response.ok) {
      return record(delivery, response.retry ? retry(delivery, response.code) : failed(response.code));
    }

    const receipts = response.data;
    const receipt = receipts && typeof receipts === 'object' && Object.hasOwn(receipts, delivery.ticket_id)
      ? (receipts as Record<string, { status?: string }>)[delivery.ticket_id]
      : undefined;

    if (receipt?.status === 'ok') {
      return record(delivery, { state: 'sent' });
    }
    if (receipt?.status === 'error') {
      return record(delivery, failed(expoError(receipt)));
    }

    return record(delivery, retry(delivery, 'ReceiptNotReady'));
  });
}

export async function processCoachPushDeliveries(deliveries: CoachPushDelivery[], accessToken?: string) {
  const [tickets, receipts] = await Promise.all([
    sendPushes(deliveries.filter((delivery) => delivery.state === 'pending'), accessToken),
    checkReceipts(deliveries.filter((delivery) => delivery.state === 'submitted'), accessToken),
  ]);

  return [...tickets, ...receipts];
}
