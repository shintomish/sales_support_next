import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8090';
const apiUrl  = new URL(apiBase);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  images: {
    // 名刺画像など外部ドメインから配信する画像を Next/Image で表示するため
    remotePatterns: [
      // Supabase Storage（プロジェクト ref を問わず）
      { protocol: 'https', hostname: '**.supabase.co' },
      // バックエンド経由の画像配信（${API_URL}/storage/... 互換のため）
      {
        protocol: (apiUrl.protocol.replace(':', '') as 'http' | 'https'),
        hostname: apiUrl.hostname,
        port:     apiUrl.port || undefined,
      },
    ],
  },
};

export default nextConfig;
