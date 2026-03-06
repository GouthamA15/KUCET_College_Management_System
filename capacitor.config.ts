import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kucet.cms',
  appName: 'KUCET CMS',
  webDir: 'public',
  server: {
    url: 'https://kucet-college-management-system-test.onrender.com/',
    cleartext: true,
    allowNavigation: [
      '*.onrender.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0b3578",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff"
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "1056557602357-19j4h3fgeovk04h01pkh8h1gcl1v6v4o.apps.googleusercontent.com",
      forceCodeForRefreshToken: true
    }
  }
  };


export default config;
