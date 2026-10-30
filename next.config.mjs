/** @type {import('next').NextConfig} */
export default {
  eslint: { ignoreDuringBuilds: true },
  // Markdown aliases: /index.md, /about.md, ... serve the same Markdown twins as Accept: text/markdown.
  async rewrites() {
    return [{ source: "/:page(index|about|contact|privacy|developers).md", destination: "/md/:page" }];
  },
};
