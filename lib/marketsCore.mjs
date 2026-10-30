// Fetches live Polymarket prices from its public Gamma API. Polymarket is the only market source (Adam, Oct 29 2026).
// Nothing is cached or estimated: if the fetch fails, the caller shows no odds.
const PM = "https://gamma-api.polymarket.com";

async function getJSON(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const clean = (s) => String(s || "").replace(/\s*\((D|R|L|G|Dem|GOP)\)\s*$/i, "").trim();

export async function fetchPolymarket(slug, timeoutMs = 3500) {
  const data = await getJSON(`${PM}/events?slug=${encodeURIComponent(slug)}`, timeoutMs);
  const ev = Array.isArray(data) ? data[0] : data;
  if (!ev) throw new Error("no event");
  const outcomes = [];
  for (const m of ev.markets || []) {
    if (!m.outcomePrices || m.closed) continue;
    let prices;
    try { prices = JSON.parse(m.outcomePrices); } catch { continue; }
    const p = Number(prices[0]);
    if (!isFinite(p) || p <= 0.005 && (ev.markets || []).length > 2) continue;
    if (Number(m.volume || 0) <= 0) continue;
    outcomes.push({ name: clean(m.groupItemTitle || m.question), prob: p });
  }
  if (ev.closed) throw new Error("event closed");
  // A single Yes/No market (ballot measures): both sides are Polymarket's own quoted prices.
  if (outcomes.length === 1 && (ev.markets || []).length === 1) {
    const m = (ev.markets || []).find((x) => !x.closed && x.outcomePrices);
    const prices = JSON.parse(m.outcomePrices).map(Number);
    outcomes.splice(0, 1, { name: "Yes (passes)", prob: prices[0] }, ...(isFinite(prices[1]) ? [{ name: "No (fails)", prob: prices[1] }] : []));
  }
  if (!outcomes.length) throw new Error("no priced outcomes");
  outcomes.sort((a, b) => b.prob - a.prob);
  return {
    source: "Polymarket",
    title: ev.title,
    url: `https://polymarket.com/event/${slug}`,
    api: `${PM}/events?slug=${slug}`,
    outcomes: outcomes.slice(0, 4),
    fetchedAt: new Date().toISOString(),
  };
}

/** Competitive on Polymarket: the top contract is between 0.35 and 0.65 inclusive (Civic's market rule, Polymarket only). */
export const COMPETITIVE_LOW = 0.35, COMPETITIVE_HIGH = 0.65;
export function polymarketCloseness(quote) {
  const top = quote?.outcomes?.[0]?.prob;
  if (typeof top !== "number" || !isFinite(top)) return "No market data";
  return top >= COMPETITIVE_LOW && top <= COMPETITIVE_HIGH ? "Competitive" : "Not closely contested";
}
