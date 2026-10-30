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

async function get(path, { accept, ua, method = "GET", body, type } = {}) {
  const headers = {};
  if (type) headers["content-type"] = type;
  if (accept) headers.accept = accept;
  if (ua) headers["user-agent"] = ua;
  if (cookie) headers.cookie = cookie;
  const t0 = Date.now();
  const res = await fetch(BASE + path, { method, headers, body, redirect: "follow" });
  const text = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", vary: res.headers.get("vary") || "", headers: res.headers, body: text, ms: Date.now() - t0 };
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
for (const p of ["/", "/about", "/contact", "/privacy", "/developers"]) {
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
ok(sm.status === 200 && /xml/.test(sm.type) && locs.length === 7 && locs.includes("https://townhall.town/openapi.json") && locs.includes("https://townhall.town/llms.txt") && (sm.body.match(/<lastmod>/g) || []).length === 7, "sitemap.xml", `${sm.status} ${sm.type} ${locs.join(" ")}`);
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

// 9. API: OpenAPI spec, discovery hooks, JSON errors.
const oa = await get("/openapi.json");
let spec = null;
try { spec = JSON.parse(oa.body); } catch {}
ok(oa.status === 200 && /^application\/json/.test(oa.type) && spec?.openapi === "3.1.0" && Object.keys(spec.paths)[0] === "/api/v1/agent" && !!spec.paths["/api/v1/agent"]?.get && !!spec.paths["/api/v1/locate"]?.post && !!spec.paths["/api/agent"]?.get && !!spec.paths["/api/agent"]?.post && !!spec.paths["/api/locate"]?.post && !spec.paths["/api/locate"]?.get, "openapi.json", `${oa.status} ${oa.type} ${spec ? Object.keys(spec.paths).join(",") : "unparsed"}`);
ok(!!spec?.info?.version && !!spec?.["x-api-versioning"] && /RFC 9745/.test(spec?.info?.description || ""), "openapi versioning", spec?.info?.version);
const cat = await get("/.well-known/api-catalog");
ok(cat.status === 200 && /linkset\+json/.test(cat.type) && cat.body.includes("/openapi.json"), "api-catalog", `${cat.status} ${cat.type}`);
ok(/<link[^>]*rel="service-desc"[^>]*href="\/openapi\.json"/.test(home.body) || /<link[^>]*href="\/openapi\.json"[^>]*rel="service-desc"/.test(home.body), "homepage link rel=service-desc");
ok(/<footer[\s\S]*href="\/developers"[^>]*>API<\/a>[\s\S]*<\/footer>/.test(home.body), "footer API link");
ok(graph.some((n) => n["@type"] === "WebAPI" && /openapi\.json$/.test(n.documentation || "")), "JSON-LD WebAPI");
ok(llms.body.includes("/openapi.json") && llms.body.includes("/developers") && llms.body.includes("/developers#versioning"), "llms.txt links the API docs and versioning policy");
const dev = await get("/developers", { accept: "text/html" });
const devTitle = dev.body.match(/<title>([^<]+)<\/title>/)?.[1];
const devH1 = textOf(dev.body.match(/<h1[\s\S]*?<\/h1>/)?.[0] || "");
ok(dev.status === 200 && /curl/.test(dev.body) && dev.body.includes("/openapi.json") && dev.body.includes('id="versioning"') && dev.body.includes('id="rate-limits"'), "developers page", `${dev.status}`);
ok(/townhall\.town/.test(devTitle || "") && /townhall\.town/.test(devH1) && !/townhall\.town.*\| townhall\.town/.test(devTitle || ""), "developers title and H1 name townhall.town", `${devTitle} / ${devH1}`);
const devMd = await get("/developers.md");
ok(devMd.status === 200 && devMd.type.startsWith("text/markdown") && devMd.body.includes("## Versioning and deprecation") && devMd.body.includes("RFC 9745") && devMd.body.includes("## Rate limits"), "developers.md policy", `${devMd.status} ${devMd.type}`);
for (const [p, md] of [["/index.md", "# townhall.town"], ["/about.md", "# About"]]) {
  const r = await get(p);
  ok(r.status === 200 && r.type.startsWith("text/markdown") && r.body.startsWith(md), `markdown alias ${p}`, `${r.status} ${r.type}`);
}
async function apiErr(name, path, status, code, opts = {}) {
  const r = await get(path, opts);
  let b = null;
  try { b = JSON.parse(r.body); } catch {}
  ok(r.status === status && /^application\/json/.test(r.type) && b?.error?.code === code && typeof b?.error?.message === "string", name, `${r.status} ${r.type} ${r.body.slice(0, 90)}${opts.allow ? ` allow="${r.headers.get("allow")}"` : ""}`);
  return r;
}
await apiErr("agent GET zip=787011 -> 400", "/api/agent?zip=787011", 400, "invalid");
await apiErr("agent GET zip=7870 -> 400", "/api/agent?zip=7870", 400, "invalid");
await apiErr("agent GET zip=%2078701 -> 400", "/api/agent?zip=%2078701", 400, "invalid");
await apiErr("agent GET no zip -> 400", "/api/agent", 400, "invalid");
await apiErr('agent POST {"zip":"787011"} -> 400', "/api/agent", 400, "invalid", { method: "POST", type: "application/json", body: '{"zip":"787011"}' });
await apiErr("agent POST bad JSON -> 400", "/api/agent", 400, "invalid", { method: "POST", type: "application/json", body: "{" });
const put = await apiErr("agent PUT -> 405", "/api/agent", 405, "method_not_allowed", { method: "PUT", allow: true });
ok(put.headers.get("allow") === "GET, POST", "agent 405 Allow header", put.headers.get("allow"));
await apiErr("locate POST no lat/lon -> 400", "/api/locate", 400, "invalid", { method: "POST", type: "application/json", body: "{}" });
await apiErr("locate POST bad JSON -> 400", "/api/locate", 400, "invalid", { method: "POST", type: "application/json", body: "{" });
const lp = await apiErr("locate GET -> 405 (coordinates never in the URL)", "/api/locate?lat=30.2672&lon=-97.7431", 405, "method_not_allowed", { allow: true });
ok(lp.headers.get("allow") === "POST", "locate 405 Allow header", lp.headers.get("allow"));
await apiErr("unknown /api route -> 404", `/api/nope-${Date.now()}`, 404, "not_found");
await apiErr("unknown /api route POST -> 404", "/api/v1/ballot", 404, "not_found", { method: "POST" });
await apiErr("v1 agent GET zip=7870 -> 400", "/api/v1/agent?zip=7870", 400, "invalid");
await apiErr("v1 locate GET -> 405", "/api/v1/locate", 405, "method_not_allowed");
const v1un = await get("/api/v1/agent?zip=90210");
ok(v1un.status === 200 && v1un.type.startsWith("application/x-ndjson") && v1un.body.includes('"type":"unsupported"') && v1un.headers.get("api-version") === "1", "v1 agent uncovered ZIP", `${v1un.status} ${v1un.type} api-version=${v1un.headers.get("api-version")}`);
const rl = v1un.headers;
ok(/^"agent";q=10;w=60$/.test(rl.get("ratelimit-policy") || "") && /^"agent";r=\d+;t=\d+$/.test(rl.get("ratelimit") || "") && rl.get("ratelimit-limit") === "10" && /^\d+$/.test(rl.get("ratelimit-remaining") || "") && /^\d+$/.test(rl.get("ratelimit-reset") || ""), "RateLimit headers", `policy=${rl.get("ratelimit-policy")} rl=${rl.get("ratelimit")} limit=${rl.get("ratelimit-limit")} rem=${rl.get("ratelimit-remaining")} reset=${rl.get("ratelimit-reset")}`);
const jm = await get("/api/v1/agent?zip=90210", { accept: "application/json" });
ok(jm.status === 200 && /^application\/json/.test(jm.type) && JSON.parse(jm.body).type === "unsupported", "v1 agent JSON mode", `${jm.status} ${jm.type}`);
const un = await get("/api/agent?zip=90210");
ok(un.status === 200 && un.type.startsWith("application/x-ndjson") && un.body.includes('"type":"unsupported"') && un.body.includes("We only cover 78701 (Austin), 94103 (San Francisco) and 10001 (New York) for now."), "agent uncovered ZIP -> unsupported line", `${un.status} ${un.type}`);
const loc = await get("/api/locate", { method: "POST", type: "application/json", body: '{"lat":30.2672,"lon":-97.7431}' });
ok(loc.status === 200 && /"zip":"\d{5}"/.test(loc.body), "locate Austin", loc.body.slice(0, 80));

const lv1 = await get("/api/v1/locate", { method: "POST", type: "application/json", body: '{"lat":40.7506,"lon":-73.9972}' });
ok(lv1.status === 200 && /"zip":"\d{5}"/.test(lv1.body) && lv1.headers.get("ratelimit-policy") === '"locate";q=30;w=60', "v1 locate New York", lv1.body.slice(0, 80));

// 10. Rate limit: burst the agent (cheap 400s) until a 429. Per instance, so a burst may land on several instances.
if (process.env.RATE_BURST) {
  let hit = null;
  for (let i = 0; i < 40 && !hit; i++) {
    const r = await get("/api/v1/agent?zip=0");
    if (r.status === 429) hit = r;
  }
  let b = null;
  try { b = JSON.parse(hit?.body || ""); } catch {}
  ok(!!hit && /^\d+$/.test(hit.headers.get("retry-after") || "") && b?.error?.code === "rate_limited" && /^application\/json/.test(hit.type), "429 with Retry-After", hit ? `retry-after=${hit.headers.get("retry-after")} ${hit.body.slice(0, 100)}` : "no 429 in 40 requests");
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
