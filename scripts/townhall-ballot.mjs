#!/usr/bin/env node
// Example client for the townhall.town API (https://townhall.town/developers). Not an official package.
// Needs Node 18+ (built-in fetch). No dependencies, no key.
//
//   node scripts/townhall-ballot.mjs 78701            # final result as JSON
//   node scripts/townhall-ballot.mjs 94103 --stream   # every NDJSON event as it arrives
//   TOWNHALL_URL=https://example.vercel.app node scripts/townhall-ballot.mjs 10001
const base = (process.env.TOWNHALL_URL || "https://townhall.town").replace(/\/$/, "");
const [zip, flag] = process.argv.slice(2);
if (!/^\d{5}$/.test(zip || "")) {
  console.error("usage: townhall-ballot.mjs <5-digit ZIP> [--stream]");
  process.exit(2);
}
const stream = flag === "--stream";
const res = await fetch(`${base}/api/v1/agent?zip=${zip}`, { headers: { accept: stream ? "application/x-ndjson" : "application/json" } });
const left = res.headers.get("ratelimit-remaining");
if (left !== null) console.error(`rate limit: ${left} requests left, window resets in ${res.headers.get("ratelimit-reset")}s`);
if (!res.ok) {
  const retry = res.headers.get("retry-after");
  console.error(`HTTP ${res.status}${retry ? ` (retry after ${retry}s)` : ""}:`, await res.text());
  process.exit(1);
}
if (!stream) {
  console.log(JSON.stringify(await res.json(), null, 2));
} else {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) console.log(line);
    }
  }
  if (buf.trim()) console.log(buf.trim());
}
