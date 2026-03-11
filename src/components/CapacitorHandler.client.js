'use client';
import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export default function CapacitorHandler() {
  useEffect(() => {
    // 1. Initialize Status Bar
    const initStatusBar = async () => {
      try {
        await StatusBar.setBackgroundColor({ color: '#0b3578' }); // KUCET Blue
        await StatusBar.setStyle({ style: Style.Dark }); // Light icons on dark background
      } catch (err) {
        console.warn('Capacitor Status Bar not available:', err);
      }
    };

    // 2. Initialize Back Button
    const initBackButton = async () => {
      try {
        await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });

        // --- NEW: Handle Google Login Deep Linking ---
        await App.addListener('appUrlOpen', ({ url }) => {
          // If the app is opened via a link (like the Google OAuth redirect)
          // we force the internal WebView to load that URL.
          if (url.includes('kucet-college-management-system-test.onrender.com')) {
            const path = url.split('kucet-college-management-system-test.onrender.com')[1];
            if (path) window.location.href = path;
          } else if (url.startsWith('kucetcms://')) {
             // Handle custom scheme redirect (e.g. kucetcms://login-success)
             window.location.href = '/'; // Refresh to check for new session
          }
        });
      } catch (err) {
        console.warn('Capacitor App plugin not available:', err);
      }
    };

    if (typeof window !== 'undefined') {
      initStatusBar();
      initBackButton();
    }
  }, []);

  return null;
}
