import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages (next-on-pages) 用設定
  // Edge RuntimeではNode.js独自APIが使えないため、画像最適化はオフ
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
