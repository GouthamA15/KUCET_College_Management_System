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
            // No history, exit app
            App.exitApp();
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
