#!/usr/bin/env node
// HTTP checks for agent readiness against a running deployment.
// Usage: node scripts/verify-agentic.mjs [baseUrl]   (default http://localhost:3000)
// For an SSO-protected Vercel preview set VERCEL_SHARE=<token from a ?_vercel_share= link>.
const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SHARE = process.env.VERCEL_SHARE;
let cookie = "";
let failed = 0;

const ok = (cond, name, detail = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function get(path, { accept, ua } = {}) {
  const headers = {};
  if (accept) headers.accept = accept;
  if (ua) headers["user-agent"] = ua;
  if (cookie) headers.cookie = cookie;
  const t0 = Date.now();
  const res = await fetch(BASE + path, { headers, redirect: "follow" });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", vary: res.headers.get("vary") || "", headers: res.headers, body, ms: Date.now() - t0 };
}

const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#x27;|&amp;|&quot;|&lt;|&gt;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const meta = (html, attr, key) => html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, "i"))?.[1];

if (SHARE) {
  const res = await fetch(`${BASE}/?_vercel_share=${SHARE}`, { redirect: "manual" });
  cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  ok(!!cookie, "share link sets an access cookie", `status ${res.status}`);
}

// 1-2. Markdown negotiation on every page, HTML stays HTML.
for (const p of ["/", "/about", "/contact", "/privacy"]) {
  const md = await get(p, { accept: "text/markdown" });
  ok(md.status === 200 && md.type.startsWith("text/markdown") && /(^|,)\s*accept\s*(,|$)/i.test(md.vary) && md.body.startsWith("# "), `markdown ${p}`, `${md.status} ${md.type} vary="${md.vary}" ${md.body.length}B`);
  const html = await get(p, { accept: "text/html" });
  ok(html.status === 200 && html.type.startsWith("text/html"), `html ${p}`, `${html.status} ${html.type}`);
  // Static prerenders keep Next's own Vary on Vercel, so Accept on the HTML variant is informational only.
  if (!/(^|,)\s*accept\s*(,|$)/i.test(html.vary)) console.log(`WARN  html ${p} Vary lacks Accept  (vary="${html.vary}")`);
}

// 3. 404s.
const probe = `/__probe-${Date.now()}`;
const nf = await get(probe, { accept: "text/markdown" });
ok(nf.status === 404 && nf.type.startsWith("text/markdown") && nf.body.length >= 20 && nf.body.includes("/llms.txt") && nf.body.includes("/sitemap.xml"), "markdown 404", `${nf.status} ${nf.type} ${nf.body.length}B`);
const nfh = await get(probe, { accept: "text/html" });
ok(nfh.status === 404 && nfh.type.startsWith("text/html"), "html 404", `${nfh.status} ${nfh.type}`);

// 4. llms.txt.
const llms = await get("/llms.txt");
ok(llms.status === 200 && /^# \S/.test(llms.body) && /\n> \S/.test(llms.body) && /^## When to use this$/m.test(llms.body), "llms.txt", `${llms.status} ${llms.type} ${llms.body.length}B`);
const full = await get("/llms-full.txt");
ok(full.status === 200 && full.body.length > llms.body.length, "llms-full.txt", `${full.status} ${full.body.length}B`);

// 5. sitemap and robots.
const sm = await get("/sitemap.xml");
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(sm.status === 200 && /xml/.test(sm.type) && locs.length === 4 && (sm.body.match(/<lastmod>/g) || []).length === 4, "sitemap.xml", `${sm.status} ${sm.type} ${locs.join(" ")}`);
const rb = await get("/robots.txt");
ok(rb.status === 200 && /User-Agent: \*/i.test(rb.body) && /^Allow: \/$/m.test(rb.body) && !/^Disallow: \/$/m.test(rb.body) && /Sitemap: https:\/\/townhall\.town\/sitemap\.xml/.test(rb.body), "robots.txt", rb.body.replace(/\n/g, " | "));

// 6. Homepage raw HTML: text, headings, metadata, JSON-LD.
const home = await get("/", { accept: "text/html" });
const homeText = textOf(home.body);
ok(homeText.length >= 500, "homepage text without JS", `${homeText.length} chars`);
const heads = [...home.body.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
ok(heads.filter((h) => h === 1).length === 1 && heads.every((h, i) => i === 0 || h <= heads[i - 1] + 1), "one H1, sequential headings", heads.join(","));
ok(/<html[^>]*lang="en"/.test(home.body), "html lang");
const canonical = home.body.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
ok(canonical === "https://townhall.town" || canonical === "https://townhall.town/", "canonical", canonical);
const ogImage = meta(home.body, "property", "og:image");
ok(meta(home.body, "property", "og:type") === "website" && !!ogImage, "og:type and og:image", `${meta(home.body, "property", "og:type")} ${ogImage}`);
const title = home.body.match(/<title>([^<]+)<\/title>/)?.[1];
ok(!!title && /ballot/i.test(title) && (home.body.match(/<title>/g) || []).length === 1, "title", title);
ok(!!meta(home.body, "name", "description"), "description", meta(home.body, "name", "description"));
if (ogImage) {
  const img = await get(new URL(ogImage).pathname + new URL(ogImage).search);
  ok(img.status === 200 && img.type.startsWith("image/"), "og:image fetch", `${img.status} ${img.type} (fetched from ${BASE})`);
}
const ld = [...home.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const graph = ld.flatMap((d) => d["@graph"] || [d]);
const app = graph.find((n) => n["@type"] === "WebApplication" || n["@type"] === "SoftwareApplication");
const org = graph.find((n) => n["@type"] === "Organization");
ok(!!app && app.offers?.price === "0" && app.operatingSystem === "Web", "JSON-LD WebApplication", app && Object.keys(app).join(","));
ok(!!org && org.contactPoint?.contactType === "customer support", "JSON-LD Organization contactPoint", org && JSON.stringify(org.contactPoint));

// 7. Trust pages: main text in raw HTML.
for (const p of ["/about", "/contact", "/privacy"]) {
  const r = await get(p, { accept: "text/html" });
  const main = textOf(r.body.match(/<main[\s\S]*<\/main>/)?.[0] || "");
  ok(main.length >= 500, `trust page ${p}`, `${main.length} chars in <main>`);
}

// 8. Agent user agents reach the homepage.
for (const ua of ["GPTBot/1.1 (+https://openai.com/gptbot)", "ClaudeBot/1.0 (+claudebot@anthropic.com)", "PerplexityBot/1.0 (+https://perplexity.ai/perplexitybot)", "OAI-SearchBot/1.0 (+https://openai.com/searchbot)", "Google-Extended", "curl/8"]) {
  const r = await get("/", { ua });
  ok(r.status === 200, `UA ${ua.split("/")[0]}`, `${r.status} ${r.ms}ms`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
