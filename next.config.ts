import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
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
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    // pdfjs-dist v5 ships pre-bundled with its own webpack runtime.
    // Re-parsing either the standard or legacy build causes Object.defineProperty conflicts.
    const existing = config.module.noParse;
    const pdfjsPattern = /pdfjs-dist\/(?:legacy\/)?build\/pdf(\.worker(\.min)?)?(\.min)?\.m?js$/;
    if (existing instanceof RegExp) {
      config.module.noParse = [existing, pdfjsPattern];
    } else if (Array.isArray(existing)) {
      existing.push(pdfjsPattern);
    } else {
      config.module.noParse = pdfjsPattern;
    }
    return config;
  },
};

export default nextConfig;
