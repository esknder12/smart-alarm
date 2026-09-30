// Browser Notification Utility for the Niqu ንቁ App

import { APP_NAME } from '../constants';

export interface NotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission;
}

export const getNotificationStatus = (): NotificationStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { isSupported: false, permission: 'denied' };
  }
  return {
    isSupported: true,
    permission: Notification.permission,
  };
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const sendAlarmNotification = (title: string, time: string): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      const options: NotificationOptions = {
        body: `⏰ It's ${time}! Time to wake up: ${title}`,
        icon: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=128&auto=format&fit=crop&q=80',
        badge: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=128&auto=format&fit=crop&q=80',
        tag: 'wakeup-alarm-' + Date.now(),
        requireInteraction: true,
      };

      const notification = new Notification(`⏰ Alarm Ringing: ${title}`, options);

      notification.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus();
        }
        notification.close();
      };

      return true;
    } catch (e) {
      console.error('Failed to trigger notification:', e);
      return false;
    }
  }

  return false;
};

export const sendTestNotification = (): boolean => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification('🔔 Notifications Enabled!', {
        body: `${APP_NAME} will notify you even when the tab is in the background.`,
        icon: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?w=128&auto=format&fit=crop&q=80',
      });
      setTimeout(() => notification.close(), 5000);
      return true;
    } catch (e) {
      console.error('Test notification failed:', e);
      return false;
    }
  }
  return false;
};
