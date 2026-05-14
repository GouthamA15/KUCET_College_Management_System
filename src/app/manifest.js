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
        src: '/assets/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/assets/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
