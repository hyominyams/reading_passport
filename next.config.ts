import type { NextConfig } from 'next';
import os from 'node:os';

function getAllowedDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1']);

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const info of addresses ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        origins.add(info.address);
      }
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  devIndicators: false,
  serverExternalPackages: ['@napi-rs/canvas'],
  experimental: {
    proxyClientMaxBodySize: '12mb',
  },
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
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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
