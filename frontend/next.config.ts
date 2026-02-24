import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Set the output file tracing root to the parent directory to handle workspace setup
  outputFileTracingRoot: path.join(__dirname, '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: false, // Let nginx handle compression

  serverExternalPackages: ['bcryptjs'],
};

export default nextConfig;
