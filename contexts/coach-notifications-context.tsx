import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import type { UnreadCoachReply } from '@/types/chat';
import { loadUnreadCoachReplies, markChatThreadRead } from '@/utils/supabase-chat';

type CoachNotifications = {
  unreadReplies: UnreadCoachReply[];
  isAppActive: boolean;
  markReplyRead: (threadId: string, readThrough: string) => Promise<void>;
};

const CoachNotificationsContext = createContext<CoachNotifications | null>(null);
const emptyReplies: UnreadCoachReply[] = [];
const replyCheckInterval = 8_000;

export function CoachNotificationsProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const userId = mode === 'authenticated' ? user?.id : undefined;
  const [isAppActive, setAppActive] = useState(() => !AppState.currentState || AppState.currentState === 'active');
  const [snapshot, setSnapshot] = useState<{ userId: string; replies: UnreadCoachReply[] }>();
  const refreshCurrent = useRef<(() => void) | null>(null);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!userId || !isAppActive) {
      return;
    }

    const accountId = userId;
    let active = true;
    let isLoading = false;
    let refreshQueued = false;

    async function refresh() {
      if (isLoading) {
        refreshQueued = true;
        return;
      }

      isLoading = true;
      try {
        const replies = await loadUnreadCoachReplies(accountId);
        if (active) {
          setSnapshot({ userId: accountId, replies });
        }
      } catch {
        // Keep the last known unread replies when the connection is unavailable.
      } finally {
        isLoading = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    }

    refreshCurrent.current = refresh;
    const interval = setInterval(refresh, replyCheckInterval);
    void refresh();

    return () => {
      active = false;
      refreshCurrent.current = null;
      clearInterval(interval);
    };
  }, [isAppActive, userId]);

  const markReplyRead = useCallback(async (threadId: string, readThrough: string) => {
    if (!userId) {
      return;
    }

    await markChatThreadRead(threadId, userId, readThrough);
    refreshCurrent.current?.();
  }, [userId]);

  const unreadReplies = snapshot?.userId === userId ? snapshot?.replies ?? emptyReplies : emptyReplies;
  const value = useMemo(() => ({ unreadReplies, isAppActive, markReplyRead }), [unreadReplies, isAppActive, markReplyRead]);

  return <CoachNotificationsContext.Provider value={value}>{children}</CoachNotificationsContext.Provider>;
}

export function useCoachNotifications() {
  const context = useContext(CoachNotificationsContext);
  if (!context) {
    throw new Error('useCoachNotifications must be used inside CoachNotificationsProvider');
  }

  return context;
}
