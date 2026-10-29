// Refreshes data/markets-cache.json from live public APIs. Run: node scripts/cache-markets.mjs
import fs from "node:fs";
import { fetchPolymarket, fetchKalshi } from "../lib/marketsCore.mjs";
const map = JSON.parse(fs.readFileSync("data/markets-map.json", "utf8"));
const out = {};
for (const [race, m] of Object.entries(map)) {
  out[race] = [];
  if (m.polymarket) try { out[race].push(await fetchPolymarket(m.polymarket, 8000)); } catch (e) { console.error(race, "pm", e.message); }
  if (m.kalshi) try { out[race].push(await fetchKalshi(m.kalshi, 8000)); } catch (e) { console.error(race, "kalshi", e.message); }
}
fs.writeFileSync("data/markets-cache.json", JSON.stringify(out, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.map((x) => x.source + ":" + x.outcomes.map((o) => o.name + "=" + o.prob).join(","))])));
