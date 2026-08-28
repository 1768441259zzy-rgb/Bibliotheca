import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  transpilePackages: ['pdfjs-dist', 'xlsx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;

// 仅本地 next dev；Vercel / CI 上不要初始化 Cloudflare 模拟环境
if (
  process.env.NODE_ENV === 'development' &&
  !process.env.VERCEL &&
  !process.env.CI
) {
  initOpenNextCloudflareForDev();
}
