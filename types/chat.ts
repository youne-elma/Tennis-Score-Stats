export type UserRole = 'user' | 'coach' | 'admin';

export type ChatThreadStatus = 'open' | 'closed';

export type ChatMessageType = 'text' | 'match_stats';

export type ChatThread = {
  id: string;
  createdBy: string;
  assignedCoachId?: string;
  status: ChatThreadStatus;
  subject?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatParticipant = {
  threadId: string;
  userId: string;
  participantRole: UserRole;
  joinedAt: string;
  lastReadAt?: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  messageType: ChatMessageType;
  body: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageInput = {
  threadId: string;
  senderId: string;
  body: string;
  messageType?: ChatMessageType;
  metadata?: Record<string, unknown>;
};
