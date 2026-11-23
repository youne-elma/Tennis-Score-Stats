import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/ui/app-card';
import { AppTheme } from '@/constants/theme';
import { useCoachNotifications } from '@/contexts/coach-notifications-context';

export function CoachReplyNotification() {
  const { unreadReplies, isAppActive } = useCoachNotifications();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [dismissedReplyIds, setDismissedReplyIds] = useState<ReadonlySet<string>>(() => new Set());
  const reply = unreadReplies.find(({ id }) => !dismissedReplyIds.has(id));

  if (!isAppActive || !reply || pathname === '/coach-chat') {
    return null;
  }

  return (
    <View style={[styles.position, { top: insets.top + 10 }]}>
      <AppCard tone="gold" style={styles.banner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open coach reply"
          style={styles.openReply}
          onPress={() => router.push({ pathname: '/coach-chat', params: { threadId: reply.threadId } })}>
          <MaterialIcons name="notifications" size={23} color={AppTheme.colors.primary} />
          <Text accessibilityLiveRegion="polite" style={styles.label}>Your coach replied</Text>
          <MaterialIcons name="chevron-right" size={23} color={AppTheme.colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss coach notification"
          style={styles.dismiss}
          onPress={() => setDismissedReplyIds((ids) => new Set(ids).add(reply.id))}>
          <MaterialIcons name="close" size={20} color={AppTheme.colors.textMuted} />
        </Pressable>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.tabBar,
    elevation: 8,
    flexDirection: 'row',
    maxWidth: 480,
    padding: 4,
    width: '100%',
  },
  openReply: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingLeft: 10,
  },
  label: {
    color: AppTheme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  dismiss: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    width: 44,
  },
});
