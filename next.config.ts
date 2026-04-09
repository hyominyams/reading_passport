import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@napi-rs/canvas'],
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/.playwright-cli/**',
        '**/output/playwright/**',
        '**/.tmp-session-cookie.txt',
      ],
    };

    if (dev && !isServer) {
      config.devtool = 'source-map';
    }

    return config;
  },
};

export default nextConfig;
