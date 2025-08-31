import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Set the output file tracing root to the parent directory to handle workspace setup
  outputFileTracingRoot: path.join(__dirname, '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  
  // Fix: Move serverComponentsExternalPackages from experimental to serverExternalPackages
  serverExternalPackages: ['bcryptjs'],
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
