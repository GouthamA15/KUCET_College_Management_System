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
    console.log('[Notification-Web-Fallback]', title, body);
    return;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[Notification] Permission not granted');
      return;
    }

    console.log('[Notification-Native] Scheduling:', title);
    
    // For testing, we use a near-immediate trigger (100ms)
    // Older Android versions sometimes struggle with exact 0ms or far-future dates
    const triggerDate = new Date(Date.now() + 500);

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000), // Random ID
          schedule: { at: triggerDate }, 
          extra,
          sound: 'default', // Using default instead of null for better Android compatibility
          smallIcon: 'ic_stat_name', // Standard Capacitor icon name
          actionTypeId: '',
          controlBadge: true
        }
      ]
    });
    console.log('[Notification-Native] Scheduled successfully');
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};
