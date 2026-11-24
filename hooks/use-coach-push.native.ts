import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { CoachPushOptions, CoachPushSettings } from '@/types/coach-push';
import { disableCoachPushDevice, readCoachPushDevice, registerCoachPushDevice } from '@/utils/coach-push-device';

const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
const supportsPush = Boolean(projectId) && !isRunningInExpoGo();

type CoachReply = {
  threadId: string;
  recipientId: string;
};

type PushState = {
  userId: string;
  enabled: boolean;
  error?: string;
};

function readCoachReply(data: Record<string, unknown>): CoachReply | undefined {
  if (data.type === 'coach-reply' && typeof data.threadId === 'string' && data.threadId
    && typeof data.recipientId === 'string' && data.recipientId) {
    return { threadId: data.threadId, recipientId: data.recipientId };
  }
}

async function getCoachPushToken(askPermission: boolean) {
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('coach-replies', {
      name: 'Coach replies',
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }

  let permission = await notifications.getPermissionsAsync();
  const isAllowed = (result: typeof permission) =>
    result.granted || result.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!isAllowed(permission) && askPermission && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync();
  }
  if (!isAllowed(permission)) {
    return undefined;
  }

  return (await notifications.getExpoPushTokenAsync({ projectId })).data;
}

export function useCoachPush({ userId, isAppActive, isAuthLoading, onReply }: CoachPushOptions): CoachPushSettings | undefined {
  const [settings, setSettings] = useState<PushState>();
  const [isChanging, setIsChanging] = useState(false);
  const [openReply, setOpenReply] = useState<CoachReply>();
  const changing = useRef(false);
  const handledResponse = useRef<string | undefined>(undefined);
  const loginPrompted = useRef(false);
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const pathname = usePathname();
  const currentSettings = settings?.userId === userId ? settings : undefined;

  useEffect(() => {
    if (!supportsPush) {
      return;
    }

    let active = true;
    let cleanup: (() => void) | undefined;
    void import('expo-notifications').then((notifications) => {
      if (!active) {
        return;
      }

      notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const show = !readCoachReply(notification.request.content.data);
          return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
        },
      });

      function openNotification(response: import('expo-notifications').NotificationResponse) {
        const { request } = response.notification;
        const reply = readCoachReply(request.content.data);
        if (reply && request.identifier !== handledResponse.current) {
          handledResponse.current = request.identifier;
          loginPrompted.current = false;
          notifications.clearLastNotificationResponse();
          setOpenReply(reply);
        }
      }

      const received = notifications.addNotificationReceivedListener((notification) => {
        if (readCoachReply(notification.request.content.data)) {
          onReply();
        }
      });
      const tapped = notifications.addNotificationResponseReceivedListener(openNotification);
      cleanup = () => {
        received.remove();
        tapped.remove();
        notifications.setNotificationHandler(null);
      };

      const lastResponse = notifications.getLastNotificationResponse();
      if (lastResponse) {
        openNotification(lastResponse);
      }
    }).catch(() => {
      // Registration reports unavailable native notifications when the player enables them.
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [onReply]);

  useEffect(() => {
    if (!openReply || isAuthLoading || !navigationReady) {
      return;
    }

    if (!userId) {
      if (!loginPrompted.current) {
        loginPrompted.current = true;
        if (pathname !== '/auth/login') {
          router.push('/auth/login');
        }
      }
      return;
    }

    setOpenReply(undefined);
    if (openReply.recipientId === userId) {
      router.push({ pathname: '/coach-chat', params: { threadId: openReply.threadId } });
    }
  }, [isAuthLoading, navigationReady, openReply, pathname, userId]);

  useEffect(() => {
    if (!supportsPush || !userId || !isAppActive || changing.current) {
      return;
    }

    const accountId = userId;
    let active = true;

    async function restoreDevice() {
      try {
        const device = await readCoachPushDevice();
        if (!active || changing.current) {
          return;
        }

        const ownDevice = device?.userId === accountId ? device : null;
        setSettings({ userId: accountId, enabled: Boolean(ownDevice?.enabled) });
        if (!ownDevice) {
          return;
        }
        if (!ownDevice.enabled) {
          await disableCoachPushDevice(accountId);
          return;
        }

        const token = await getCoachPushToken(false);
        if (!active || changing.current) {
          return;
        }

        if (token) {
          await registerCoachPushDevice(accountId, token, true);
        } else {
          await disableCoachPushDevice(accountId);
          if (active && !changing.current) {
            setSettings({ userId: accountId, enabled: false });
          }
        }
      } catch {
        if (active && !changing.current) {
          setSettings((current) => current?.userId === accountId ? current : {
            userId: accountId,
            enabled: false,
            error: 'Could not load coach notification settings. Try again.',
          });
        }
      }
    }

    void restoreDevice();
    return () => {
      active = false;
    };
  }, [isAppActive, userId]);

  if (!supportsPush || !userId) {
    return undefined;
  }

  const accountId = userId;
  const enabled = currentSettings?.enabled ?? false;

  async function setEnabled(nextEnabled: boolean) {
    if (changing.current) {
      return;
    }

    changing.current = true;
    setIsChanging(true);
    setSettings({ userId: accountId, enabled });
    try {
      if (nextEnabled) {
        const token = await getCoachPushToken(true);
        if (!token) {
          setSettings({ userId: accountId, enabled: false, error: 'Allow notifications in your device settings.' });
          return;
        }

        await registerCoachPushDevice(accountId, token);
      } else {
        await disableCoachPushDevice(accountId);
      }
      setSettings({ userId: accountId, enabled: nextEnabled });
    } catch {
      setSettings({
        userId: accountId,
        enabled,
        error: nextEnabled ? 'Could not enable coach notifications. Try again.' : 'Could not turn off coach notifications. Try again.',
      });
    } finally {
      changing.current = false;
      setIsChanging(false);
    }
  }

  return { enabled, isChanging: isChanging || !currentSettings, error: currentSettings?.error, setEnabled };
}
