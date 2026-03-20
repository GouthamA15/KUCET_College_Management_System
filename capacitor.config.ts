import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kucet.cms',
  appName: 'KUCET CMS',
  webDir: 'public',
  server: {
    url: 'https://kucet-college-management-system-test.vercel.app',
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
    SocialLogin: {
      google: {
        webClientId: "420881800284-cnmbp5lldqrq7bb67p00uhhgbaudrolq.apps.googleusercontent.com"
      }
    }
    }
    };

export default config;
