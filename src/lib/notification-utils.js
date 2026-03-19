import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Detects if the app is running on a native platform via Capacitor.
 */
const isCapacitor = () => {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  console.log('[Notification-Utils] isNativePlatform?', isNative);
  return isNative;
};

/**
 * Requests permission for local notifications if needed.
 */
export const requestNotificationPermission = async () => {
  if (!isCapacitor()) return false;

  try {
    const status = await LocalNotifications.checkPermissions();
    console.log('[Notification-Utils] Permission Status:', status.display);
    
    if (status.display !== 'granted') {
      console.log('[Notification-Utils] Requesting permissions...');
      const requestStatus = await LocalNotifications.requestPermissions();
      console.log('[Notification-Utils] Request Result:', requestStatus.display);
      return requestStatus.display === 'granted';
    }
    return true;
  } catch (error) {
    console.error('[Notification-Utils] Permission error:', error);
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
  console.log('[Notification-Utils] Attempting notification:', title);
  
  if (!isCapacitor()) {
    console.log('[Notification-Web-Fallback]', title, body);
    return;
  }

  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[Notification-Utils] No permission, aborting schedule');
      return;
    }

    // Trigger in the near future
    const triggerDate = extra.triggerAt instanceof Date ? extra.triggerAt : new Date(Date.now() + 500);
    console.log('[Notification-Utils] Scheduling for:', triggerDate.toLocaleTimeString());

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000), // Random ID
          schedule: { at: triggerDate }, 
          extra,
          sound: 'default', 
          actionTypeId: '',
          controlBadge: true
        }
      ]
    });
    console.log('[Notification-Utils] Successfully scheduled with Capacitor');
    // For debugging: show a toast/alert if scheduling seems successful in code
    if (typeof window !== 'undefined') {
       // toast.success('Scheduled!'); 
    }
  } catch (error) {
    console.error('[Notification-Utils] Failed to schedule:', error);
    if (typeof window !== 'undefined') {
        alert('Notification Plugin Error: ' + error.message);
    }
  }
};
