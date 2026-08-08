import { getAssetUrl } from '@/lib/assets';

export default function manifest() {
  return {
    name: 'KUCET College Management System',
    short_name: 'KUCET CMS',
    description: 'Comprehensive academic lifecycle management for KUCET.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b3578',
    icons: [
      {
        src: getAssetUrl('/assets/ku-logo.png'),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: getAssetUrl('/assets/ku-logo.png'),
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicon.ico',
        sizes: '64x64 32x32 24x24 16x16',
        type: 'image/x-icon',
      }
    ],
  };
}

