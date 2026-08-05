import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['pdfjs-dist'],
};

export default nextConfig;

// Cloudflare OpenNext：本地 next dev 时接入 bindings
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
