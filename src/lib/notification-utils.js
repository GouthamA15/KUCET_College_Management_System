import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Detects if the app is running on a native platform via Capacitor.
 */
const isCapacitor = () => {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
};

/**
 * Requests permission for local notifications if needed.
 */
export const requestNotificationPermission = async () => {
  if (!isCapacitor()) return false;

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      const requestStatus = await LocalNotifications.requestPermissions();
      return requestStatus.display === 'granted';
    }
    return true;
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
};

/**
 * Schedules a local notification.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {Object} extra - Extra data to pass with the notification.
 */
export const showLocalNotification = async (title, body, extra = {}) => {
  if (!isCapacitor()) {
    // Fallback for web: we could use native browser Notification API if needed,
    // but for now, we'll just return as the user specifically asked for Android notifications.
    return;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000), // Random ID
          schedule: { at: new Date(Date.now() + 1000) }, // Schedule for 1 second from now
          extra,
          sound: null,
          attachments: null,
          actionTypeId: '',
          controlBadge: true
        }
      ]
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};
