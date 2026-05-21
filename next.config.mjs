import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";
import os from "os";

// Dynamically get all local network IPs to automate allowedDevOrigins
const getLocalExternalIPs = () => {
  const interfaces = os.networkInterfaces();
  const addresses = ['localhost:3000'];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      // family can be 'IPv4' or 4 depending on Node.js version
      if ((address.family === 'IPv4' || address.family === 4) && !address.internal) {
        addresses.push(address.address);
        addresses.push(`${address.address}:3000`);
      }
    }
  }
  return addresses;
};

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
  reactCompiler: true,
  experimental: {
    allowedDevOrigins: getLocalExternalIPs(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: res.cloudinary.com;
      font-src 'self' data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      connect-src 'self' res.cloudinary.com *.sentry.io *.supabase.co wss://*.supabase.co;
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
            value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

const configWithSentry = withSentryConfig(nextConfig, {
  silent: true,
  org: "kucet-cms",
  project: "kucet-cms-nextjs",
}, {
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});

export default withPWA(configWithSentry);
