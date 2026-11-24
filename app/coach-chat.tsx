import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachConversation } from '@/components/coach-chat/conversation';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useCoachNotifications } from '@/contexts/coach-notifications-context';
import { useChatQuery } from '@/hooks/use-chat-query';
import { getOrCreateUserCoachThread, loadChatThread, loadChatThreads, loadUserRole } from '@/utils/supabase-chat';

type InboxFilter = 'all' | 'needs-reply';

export default function CoachChatScreen() {
  const { mode, user, isLoading } = useAuth();
  const { threadId } = useLocalSearchParams<{ threadId?: string }>();
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');

  if (mode === 'authenticated' && user) {
    if (typeof threadId === 'string' && threadId) {
      return <CoachThread key={`${user.id}:${threadId}`} userId={user.id} threadId={threadId} />;
    }

    return (
      <ChatLayout title="Coach Chat" backLabel="Go back" onBack={exitChat}>
        <CoachInbox
          key={user.id}
          userId={user.id}
          filter={inboxFilter}
          onFilterChange={setInboxFilter}
          onOpen={(id) => router.setParams({ threadId: id })}
        />
      </ChatLayout>
    );
  }

  return (
    <ChatLayout title="Coach Chat" backLabel="Go back" onBack={exitChat}>
      <View style={styles.centered}>
        {isLoading ? (
          <Text style={styles.status}>Loading your account…</Text>
        ) : (
          <AppCard tone="muted" style={styles.loginCard}>
            <Text style={styles.threadTitle}>Login required</Text>
            <Text style={styles.status}>Sign in to start a conversation with a coach.</Text>
            <AppButton title="Login" icon="login" onPress={() => router.push('/auth/login')} />
          </AppCard>
        )}
      </View>
    </ChatLayout>
  );
}

function CoachThread({ threadId, userId }: { threadId: string; userId: string }) {
  const loadThread = useCallback(() => loadChatThread(threadId), [threadId]);
  const { data: thread, loadFailed, refresh } = useChatQuery(loadThread);

  return (
    <ChatLayout
      title={thread?.subject || 'Coach Chat'}
      backLabel="Back to conversations"
      onBack={() => router.setParams({ threadId: undefined })}>
      {thread ? (
        <CoachConversation thread={thread} userId={userId} />
      ) : (
        <View style={styles.centered}>
          {loadFailed ? (
            <AppCard tone="muted" style={styles.feedbackCard}>
              <Text accessibilityRole="alert" style={styles.error}>Could not load the conversation.</Text>
              <AppButton title="Try again" variant="secondary" onPress={refresh} />
            </AppCard>
          ) : (
            <Text style={styles.status}>{thread === null ? 'Conversation unavailable.' : 'Loading conversation…'}</Text>
          )}
        </View>
      )}
    </ChatLayout>
  );
}

function CoachInbox({
  userId, filter, onFilterChange, onOpen,
}: {
  userId: string;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  onOpen: (threadId: string) => void;
}) {
  const { unreadReplies, pushSettings } = useCoachNotifications();
  const loadInbox = useCallback(async () => {
    const [role, threads] = await Promise.all([loadUserRole(userId), loadChatThreads()]);
    return { role, threads: role === 'user' ? threads.filter((thread) => thread.createdBy === userId) : threads };
  }, [userId]);
  const { data: inbox, loadFailed, refresh } = useChatQuery(loadInbox);
  const [isOpening, setIsOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const threads = inbox?.threads ?? [];
  const canManageInbox = inbox?.role === 'coach' || inbox?.role === 'admin';
  const threadsNeedingReply = threads.filter(
    (thread) => thread.status === 'open' && thread.lastMessageSenderId === thread.createdBy
  );
  const showNeedsReply = canManageInbox && filter === 'needs-reply';
  const visibleThreads = showNeedsReply ? threadsNeedingReply : threads;
  const canStart = inbox?.role === 'user' && !threads.some((thread) => thread.status === 'open');

  async function openConversation() {
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    setOpenFailed(false);
    try {
      const thread = await getOrCreateUserCoachThread(userId);
      onOpen(thread.id);
    } catch {
      setOpenFailed(true);
      refresh();
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.inbox}>
      <Text accessibilityRole="header" style={styles.heading}>Conversations</Text>
      {pushSettings && (inbox?.role === 'user' || pushSettings.enabled) ? (
        <AppCard tone="muted" style={styles.feedbackCard}>
          <AppButton
            title={pushSettings.isChanging
              ? 'Updating notifications…'
              : pushSettings.enabled ? 'Turn off coach notifications' : 'Enable coach notifications'}
            icon={pushSettings.enabled ? 'notifications-off' : 'notifications'}
            variant="secondary"
            disabled={pushSettings.isChanging}
            onPress={() => pushSettings.setEnabled(!pushSettings.enabled)}
          />
          {pushSettings.error ? (
            <Text accessibilityRole="alert" style={styles.error}>{pushSettings.error}</Text>
          ) : null}
        </AppCard>
      ) : null}
      {canManageInbox ? (
        <SegmentedControl<InboxFilter>
          options={[
            { label: 'All', value: 'all' },
            { label: `Needs reply (${threadsNeedingReply.length})`, value: 'needs-reply' },
          ]}
          value={filter}
          onChange={onFilterChange}
        />
      ) : null}
      {loadFailed ? (
        <AppCard tone="muted" style={styles.feedbackCard}>
          <Text accessibilityRole="alert" style={styles.error}>Could not load conversations.</Text>
          <AppButton title="Try again" variant="secondary" onPress={refresh} />
        </AppCard>
      ) : null}
      {!inbox && !loadFailed ? <Text style={styles.status}>Loading conversations…</Text> : null}
      {inbox && visibleThreads.length === 0 ? (
        <Text style={styles.status}>{showNeedsReply ? 'No conversations need a reply.' : 'No conversations yet.'}</Text>
      ) : null}
      {canStart ? (
        <AppButton
          title={isOpening ? 'Opening…' : 'Start conversation'}
          icon="forum"
          disabled={isOpening}
          onPress={openConversation}
        />
      ) : null}
      {openFailed ? (
        <Text accessibilityRole="alert" style={styles.error}>Could not start the conversation. Try again.</Text>
      ) : null}
      {visibleThreads.map((thread) => (
        <Pressable key={thread.id} accessibilityRole="button" disabled={isOpening} onPress={() => onOpen(thread.id)}>
          <AppCard style={styles.threadCard}>
            <View style={styles.threadDetails}>
              <Text numberOfLines={1} style={styles.threadTitle}>{thread.subject || 'Coach chat'}</Text>
              <Text numberOfLines={2} style={styles.status}>{thread.lastMessagePreview || 'No messages yet'}</Text>
              {unreadReplies.some((reply) => reply.threadId === thread.id) ? (
                <Text style={styles.unread}>New reply</Text>
              ) : null}
              <Text style={styles.time}>
                {new Date(thread.lastMessageAt ?? thread.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
                {thread.status === 'closed' ? ' · Closed' : ''}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={AppTheme.colors.primary} />
          </AppCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ChatLayout({
  title, backLabel, onBack, children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.main}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel} style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

function exitChat() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/');
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: AppTheme.colors.background,
    flex: 1,
  },
  main: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: AppTheme.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: AppTheme.colors.borderGold,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  title: {
    color: AppTheme.colors.text,
    flexShrink: 1,
    fontSize: 25,
    fontWeight: '900',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 14,
    maxWidth: 420,
    width: '100%',
  },
  inbox: {
    gap: 12,
    padding: 20,
  },
  heading: {
    color: AppTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  status: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackCard: {
    gap: 10,
  },
  error: {
    color: AppTheme.colors.danger,
    fontSize: 14,
  },
  threadCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  threadDetails: {
    flex: 1,
    gap: 4,
  },
  threadTitle: {
    color: AppTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  unread: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  time: {
    color: AppTheme.colors.textSubtle,
    fontSize: 12,
  },
});
