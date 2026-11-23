import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MatchStatsMessage } from '@/components/coach-chat/match-stats-message';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTheme } from '@/constants/theme';
import { useCoachNotifications } from '@/contexts/coach-notifications-context';
import { useChatQuery } from '@/hooks/use-chat-query';
import type { ChatThread } from '@/types/chat';
import { readSharedMatchStats } from '@/utils/shared-match-stats';
import { loadChatMessages, sendChatMessage, subscribeToChatMessages } from '@/utils/supabase-chat';

export function CoachConversation({ thread, userId }: { thread: ChatThread; userId: string }) {
  const { id: threadId, createdBy, status } = thread;
  const { isAppActive, markReplyRead } = useCoachNotifications();
  const loadMessages = useCallback(() => loadChatMessages(threadId), [threadId]);
  const { data: messages, loadFailed, refresh } = useChatQuery(loadMessages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const scrollView = useRef<ScrollView>(null);
  const lastScrolledMessage = useRef<string | undefined>(undefined);
  const lastReadAttempt = useRef<string | undefined>(undefined);
  const lastMessageId = messages?.at(-1)?.id;
  const latestCoachReply = createdBy === userId ? messages?.findLast((message) => message.senderId !== userId) : undefined;
  const body = draft.trim();

  useFocusEffect(
    useCallback(() => subscribeToChatMessages(threadId, refresh), [threadId, refresh])
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAppActive || !latestCoachReply || lastReadAttempt.current === latestCoachReply.createdAt) {
        return;
      }

      const readThrough = latestCoachReply.createdAt;
      lastReadAttempt.current = readThrough;
      void markReplyRead(threadId, readThrough).catch(() => {
        if (lastReadAttempt.current === readThrough) {
          lastReadAttempt.current = undefined;
        }
      });
    }, [isAppActive, latestCoachReply, markReplyRead, threadId])
  );

  async function sendMessage() {
    if (!body || isSending || status === 'closed') {
      return;
    }

    setIsSending(true);
    setSendFailed(false);
    try {
      await sendChatMessage({ threadId, senderId: userId, body });
      setDraft('');
      refresh();
    } catch {
      setSendFailed(true);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.conversation} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loadFailed ? (
        <View style={styles.loadError}>
          <Text accessibilityRole="alert" style={styles.error}>Could not load messages.</Text>
          <AppButton title="Try again" variant="ghost" onPress={refresh} />
        </View>
      ) : null}

      <ScrollView
        ref={scrollView}
        style={styles.history}
        contentContainerStyle={styles.historyContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (lastMessageId && lastMessageId !== lastScrolledMessage.current) {
            lastScrolledMessage.current = lastMessageId;
            scrollView.current?.scrollToEnd({ animated: false });
          }
        }}>
        {messages?.length === 0 ? <Text style={styles.status}>No messages yet.</Text> : null}
        {!messages && !loadFailed ? <Text style={styles.status}>Loading messages…</Text> : null}
        {messages?.map((message) => {
          const isOwnMessage = message.senderId === userId;
          const sender = isOwnMessage ? 'You' : message.senderId === createdBy ? 'Player' : 'Coach';
          const matchStats = message.messageType === 'match_stats'
            ? readSharedMatchStats(message.metadata?.matchStats)
            : undefined;

          return (
            <View key={message.id} style={[styles.message, isOwnMessage && styles.ownMessage, matchStats && styles.statsMessage]}>
              <Text style={styles.sender}>{sender}</Text>
              {matchStats ? <MatchStatsMessage stats={matchStats} /> : <Text style={styles.body}>{message.body}</Text>}
              <Text style={styles.time}>
                {new Date(message.createdAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {status === 'closed' ? (
        <Text style={styles.closed}>This conversation is closed.</Text>
      ) : (
        <View style={styles.composer}>
          <AppInput
            accessibilityLabel="Message"
            label="Message"
            placeholder="Write a message"
            value={draft}
            onChangeText={setDraft}
            editable={!isSending}
            multiline
            style={styles.input}
          />
          {sendFailed ? (
            <Text accessibilityRole="alert" style={styles.error}>Could not send your message. Try again.</Text>
          ) : null}
          <AppButton
            title={isSending ? 'Sending…' : 'Send'}
            icon="send"
            style={styles.sendButton}
            disabled={!body || isSending}
            onPress={sendMessage}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conversation: {
    flex: 1,
  },
  history: {
    flex: 1,
  },
  historyContent: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  message: {
    alignSelf: 'flex-start',
    backgroundColor: AppTheme.colors.surface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.lg,
    borderWidth: 1,
    gap: 5,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: AppTheme.colors.primaryWash,
    borderColor: AppTheme.colors.borderGold,
  },
  statsMessage: {
    maxWidth: 480,
    width: '92%',
  },
  sender: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    color: AppTheme.colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    color: AppTheme.colors.textMuted,
    fontSize: 11,
  },
  status: {
    color: AppTheme.colors.textMuted,
    paddingVertical: 16,
    textAlign: 'center',
  },
  loadError: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  error: {
    color: AppTheme.colors.danger,
    fontSize: 14,
  },
  composer: {
    borderColor: AppTheme.colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  input: {
    maxHeight: 116,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignSelf: 'flex-end',
  },
  closed: {
    color: AppTheme.colors.textMuted,
    padding: 16,
    textAlign: 'center',
  },
});
