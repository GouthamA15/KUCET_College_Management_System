/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    css: {
      lightningcss: false,
    },
  },
};

export default nextConfig;
