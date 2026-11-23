import { requireSupabase } from '@/lib/supabase';
import { ChatMessage, ChatMessageInput, ChatParticipant, ChatThread, UnreadCoachReply, UserRole } from '@/types/chat';

type SupabaseChatThreadRow = {
  id: string;
  created_by: string;
  assigned_coach_id: string | null;
  status: ChatThread['status'];
  subject: string | null;
  last_message_at: string | null;
  chat_messages?: { body: string; sender_id: string }[];
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseChatParticipantRow = {
  thread_id: string;
  user_id: string;
  participant_role: UserRole;
  joined_at: string;
  last_read_at: string | null;
};

type SupabaseChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  message_type: ChatMessage['messageType'];
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

const chatThreadSelect =
  'id,created_by,assigned_coach_id,status,subject,last_message_at,closed_at,created_at,updated_at';

const chatParticipantSelect = 'thread_id,user_id,participant_role,joined_at,last_read_at';

const chatMessageSelect = 'id,thread_id,sender_id,message_type,body,metadata,read_at,created_at,updated_at';

export async function loadUserRole(userId: string) {
  const { data, error } = await requireSupabase()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.role ?? 'user') as UserRole;
}

export async function loadChatThread(threadId: string) {
  const { data, error } = await requireSupabase()
    .from('chat_threads')
    .select(chatThreadSelect)
    .eq('id', threadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? fromSupabaseChatThread(data) : null;
}

export async function loadChatThreads() {
  const { data, error } = await requireSupabase()
    .from('chat_threads')
    .select(`${chatThreadSelect},chat_messages(body,sender_id)`)
    .order('created_at', { ascending: false, referencedTable: 'chat_messages' })
    .order('id', { ascending: false, referencedTable: 'chat_messages' })
    .limit(1, { referencedTable: 'chat_messages' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabaseChatThread);
}

export async function loadUnreadCoachReplies(userId: string): Promise<UnreadCoachReply[]> {
  const { data, error } = await requireSupabase()
    .from('chat_threads')
    .select('id,coach_replies:chat_messages!inner(id,created_at),viewer:chat_participants(last_read_at)')
    .eq('created_by', userId)
    .neq('coach_replies.sender_id', userId)
    .eq('viewer.user_id', userId)
    .order('created_at', { ascending: false, referencedTable: 'coach_replies' })
    .order('id', { ascending: false, referencedTable: 'coach_replies' })
    .limit(1, { referencedTable: 'coach_replies' });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .flatMap((thread) => {
      const reply = thread.coach_replies[0];
      const lastReadAt = thread.viewer[0]?.last_read_at;

      if (!reply || (lastReadAt && compareChatTimestamps(reply.created_at, lastReadAt) <= 0)) {
        return [];
      }

      return [{ id: reply.id, threadId: thread.id, createdAt: reply.created_at }];
    })
    .sort((left, right) => compareChatTimestamps(right.createdAt, left.createdAt));
}

export async function getOrCreateUserCoachThread(userId: string) {
  const existingThread = await loadOpenUserCoachThread(userId);

  if (existingThread) {
    await addChatParticipant(existingThread.id, userId, 'user');
    return existingThread;
  }

  const { data: threadRow, error: threadError } = await requireSupabase()
    .from('chat_threads')
    .insert({
      created_by: userId,
      subject: 'Coach chat',
    })
    .select(chatThreadSelect)
    .single();

  if (threadError) {
    throw threadError;
  }

  await addChatParticipant(threadRow.id, userId, 'user');

  return fromSupabaseChatThread(threadRow);
}

export async function loadChatParticipants(threadId: string) {
  const { data, error } = await requireSupabase()
    .from('chat_participants')
    .select(chatParticipantSelect)
    .eq('thread_id', threadId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabaseChatParticipant);
}

export async function addChatParticipant(threadId: string, userId: string, participantRole: UserRole) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('chat_participants')
    .insert({
      thread_id: threadId,
      user_id: userId,
      participant_role: participantRole,
    })
    .select(chatParticipantSelect)
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: loadError } = await supabase
        .from('chat_participants')
        .select(chatParticipantSelect)
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .single();

      if (loadError) {
        throw loadError;
      }

      return fromSupabaseChatParticipant(existing);
    }

    throw error;
  }

  return fromSupabaseChatParticipant(data);
}

export async function loadChatMessages(threadId: string) {
  const { data, error } = await requireSupabase()
    .from('chat_messages')
    .select(chatMessageSelect)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(fromSupabaseChatMessage);
}

export async function sendChatMessage(message: ChatMessageInput) {
  const { data, error } = await requireSupabase()
    .from('chat_messages')
    .insert(toSupabaseChatMessageInput(message))
    .select(chatMessageSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseChatMessage(data);
}

export async function markChatThreadRead(threadId: string, userId: string, readThrough: string) {
  const supabase = requireSupabase();
  const { data: participant, error: participantError } = await supabase
    .from('chat_participants')
    .select('last_read_at')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    throw participantError;
  }

  if (!participant) {
    await addChatParticipant(threadId, userId, 'user');
  } else if (participant.last_read_at && compareChatTimestamps(readThrough, participant.last_read_at) <= 0) {
    return;
  }

  const { error } = await supabase
    .from('chat_participants')
    .update({ last_read_at: readThrough })
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .or(`last_read_at.is.null,last_read_at.lt.${readThrough}`);

  if (error) {
    throw error;
  }
}

function compareChatTimestamps(left: string, right: string) {
  // Postgres keeps sub-millisecond precision that Date.parse drops.
  return Date.parse(left) - Date.parse(right)
    || Number(left.match(/\.\d+/)?.[0] ?? 0) - Number(right.match(/\.\d+/)?.[0] ?? 0);
}

export async function closeChatThread(threadId: string) {
  const { data, error } = await requireSupabase()
    .from('chat_threads')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .select(chatThreadSelect)
    .single();

  if (error) {
    throw error;
  }

  return fromSupabaseChatThread(data);
}

export function subscribeToChatMessages(threadId: string, onMessage: (message: ChatMessage) => void) {
  const supabase = requireSupabase();
  const channel = supabase
    .channel(`chat-messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        onMessage(fromSupabaseChatMessage(payload.new as SupabaseChatMessageRow));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

async function loadOpenUserCoachThread(userId: string) {
  const { data, error } = await requireSupabase()
    .from('chat_threads')
    .select(chatThreadSelect)
    .eq('created_by', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? fromSupabaseChatThread(data) : null;
}

function fromSupabaseChatThread(row: SupabaseChatThreadRow): ChatThread {
  const lastMessage = row.chat_messages?.[0];

  return {
    id: row.id,
    createdBy: row.created_by,
    assignedCoachId: row.assigned_coach_id ?? undefined,
    status: row.status,
    subject: row.subject ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    lastMessagePreview: lastMessage?.body,
    lastMessageSenderId: lastMessage?.sender_id,
    closedAt: row.closed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromSupabaseChatParticipant(row: SupabaseChatParticipantRow): ChatParticipant {
  return {
    threadId: row.thread_id,
    userId: row.user_id,
    participantRole: row.participant_role,
    joinedAt: row.joined_at,
    lastReadAt: row.last_read_at ?? undefined,
  };
}

function fromSupabaseChatMessage(row: SupabaseChatMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    messageType: row.message_type,
    body: row.body,
    metadata: row.metadata,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSupabaseChatMessageInput(message: ChatMessageInput) {
  return {
    thread_id: message.threadId,
    sender_id: message.senderId,
    message_type: message.messageType ?? 'text',
    body: message.body.trim(),
    metadata: message.metadata ?? {},
  };
}
