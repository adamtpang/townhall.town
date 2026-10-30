// Refreshes data/news.json: recent election headlines from local outlets (data/news-feeds.json).
// Run: node scripts/cache-news.mjs   (behind a proxy add NODE_USE_ENV_PROXY=1)
// Keeps headline, outlet, date and link only. No summaries, no rewriting. A feed that fails is logged and skipped.
import fs from "node:fs";

const MAX_PER_ZIP = 12;
const MAX_AGE_DAYS = 21;
const ELECTION = /\b(election|ballot|vote[sd]?|voting|voters?|polls?|early voting|candidates?|campaign|race|debate|proposition|prop\.? \d+|measure|bond|referendum|primary|runoff|senate|congress|governor|mayor|council|district attorney|comptroller|attorney general)\b/i;

const feeds = JSON.parse(fs.readFileSync("data/news-feeds.json", "utf8"));
const ballots = JSON.parse(fs.readFileSync("data/ballots.json", "utf8"));

// Candidate last names on each ballot count as election matches too.
function namesFor(zip) {
  const names = (ballots[zip]?.races ?? []).flatMap((r) => r.candidates.map((c) => c.name.split(/\s+/).filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop()));
  return [...new Set(names.filter((n) => n && n.length > 3))];
}

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tag = (block, name) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];

function parse(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const link = tag(b, "link") ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const date = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    return { title: decode(tag(b, "title") ?? ""), url: link ? decode(link) : "", date: date ? new Date(decode(date)) : null };
  }).filter((x) => x.title && /^https:\/\//.test(x.url) && x.date && !isNaN(x.date));
}

async function fetchFeed(url) {
  const r = await fetch(url, { headers: { "user-agent": "townhall.town news strip (+https://townhall.town)" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
const out = { fetchedAt: new Date().toISOString(), zips: {} };
for (const [zip, list] of Object.entries(feeds)) {
  if (zip.startsWith("_")) continue;
  const names = namesFor(zip);
  const nameRx = names.length ? new RegExp(`\\b(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`) : null;
  const perOutlet = [];
  for (const f of list) {
    try {
      const items = parse(await fetchFeed(f.url))
        .filter((x) => x.date.getTime() >= cutoff && (ELECTION.test(x.title) || nameRx?.test(x.title)))
        .sort((a, b) => b.date - a.date)
        .map((x) => ({ title: x.title, url: x.url, outlet: f.outlet, date: x.date.toISOString().slice(0, 10) }));
      perOutlet.push(items);
      console.log(`${zip} ${f.outlet}: ${items.length} election headlines`);
    } catch (e) {
      console.error(`${zip} ${f.outlet}: skipped (${e.message})`);
    }
  }
  // Round-robin across outlets so no single outlet fills the strip.
  const mixed = [];
  for (let i = 0; mixed.length < MAX_PER_ZIP && perOutlet.some((l) => l[i]); i++) for (const l of perOutlet) if (l[i] && mixed.length < MAX_PER_ZIP) mixed.push(l[i]);
  out.zips[zip] = mixed;
}
fs.writeFileSync("data/news.json", JSON.stringify(out, null, 1) + "\n");
console.log("wrote data/news.json:", Object.fromEntries(Object.entries(out.zips).map(([z, v]) => [z, v.length])));
