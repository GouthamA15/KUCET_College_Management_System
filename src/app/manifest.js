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
        src: getAssetUrl('assets/ku-logo.png', 'w_192,h_192,c_pad,b_white,f_auto,q_auto'),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: getAssetUrl('assets/ku-logo.png', 'w_512,h_512,c_pad,b_white,f_auto,q_auto'),
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
