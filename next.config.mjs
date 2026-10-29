/** @type {import('next').NextConfig} */
const PAGES = ["/", "/about", "/contact", "/privacy"];

export default {
  eslint: { ignoreDuringBuilds: true },
  // Pages negotiate HTML vs Markdown on the Accept header (see middleware.ts), so caches must key on it.
  async headers() {
    return PAGES.map((source) => ({
      source,
      headers: [{ key: "Vary", value: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept" }],
    }));
  },
};
