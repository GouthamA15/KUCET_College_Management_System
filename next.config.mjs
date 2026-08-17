import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  workboxOptions: {
    denylist: [/^\/api\/.*$/], // Don't cache API calls
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
  reactCompiler: true,
  // Fix Render OOM (Out of Memory) by disabling memory-heavy build steps
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    webpackBuildWorker: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.onrender.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const devConnectSrc = process.env.NODE_ENV !== 'production' ? ' localhost:4000 ws://localhost:4000' : ' localhost:4000 ws://localhost:4000';
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: res.cloudinary.com *.cloudinary.com *.s3.amazonaws.com *.r2.dev *.tailf6b4a7.ts.net *.onrender.com;
      font-src 'self' data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      connect-src 'self' res.cloudinary.com *.cloudinary.com *.s3.amazonaws.com *.r2.dev *.sentry.io *.supabase.co wss://*.supabase.co login.kucet.ac.in *.kucet.ac.in wss://*.kucet.ac.in *.tailf6b4a7.ts.net wss://*.tailf6b4a7.ts.net *.onrender.com wss://*.onrender.com${devConnectSrc};
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  org: "kucet-jv",
  project: "kucet-cms",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  // Disable Sentry sourcemap upload during build on Render to fix 8GB memory leak
  sourcemaps: {
    disable: true,
  },
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
