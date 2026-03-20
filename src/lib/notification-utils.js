import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Detects if the app is running on a native platform via Capacitor.
 */
const isCapacitor = () => {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  return isNative;
};

/**
 * Ensures a high-priority channel exists on Android.
 */
const ensureChannel = async () => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
        await LocalNotifications.createChannel({
            id: 'kucet_alerts',
            name: 'KUCET CMS Alerts',
            description: 'Critical academic and attendance alerts',
            importance: 5, // High importance
            visibility: 1, // Public
            sound: 'default',
            vibration: true,
        });
    } catch (e) {
        console.error('Failed to create notification channel');
    }
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
    console.log('[Notification-Web]', title, body);
    return;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    await ensureChannel();

    // If extra.triggerAt is provided, use it. 
    // Otherwise, use null or a very small offset to avoid "Exact Alarm" restriction issues
    // Using a 100ms offset often bypasses the "Exact Alarm" warning on some Android versions.
    const triggerDate = extra.triggerAt instanceof Date ? extra.triggerAt : new Date(Date.now() + 100);

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000),
          schedule: { 
            at: triggerDate,
            allowWhileIdle: true // Critical for background delivery
          }, 
          extra,
          channelId: 'kucet_alerts', // Use our high importance channel
          smallIcon: 'ic_launcher', // Use standard app icon
          largeIcon: 'ic_launcher',
          sound: 'default', 
          actionTypeId: '',
          controlBadge: true
        }
      ]
    });
    
    // Fallback alert for real attendance sessions when app is in foreground
    if (extra.type === 'attendance' && typeof window !== 'undefined') {
        // Only alert if we're actually in the app
        // alert('🔔 ATTENDANCE SESSION STARTED!\n' + body);
    }
  } catch (error) {
    console.error('[Notification-Utils] Error:', error);
  }
};
