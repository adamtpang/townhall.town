// Fetches public prediction-market prices. Shared by the API route and scripts/cache-markets.mjs.
const PM = "https://gamma-api.polymarket.com";
const KS = "https://api.elections.kalshi.com/trade-api/v2";

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
  if (outcomes.length === 1) outcomes[0].name = "Yes (passes)";
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

export async function fetchKalshi(eventTicker, timeoutMs = 3500) {
  const data = await getJSON(`${KS}/markets?event_ticker=${encodeURIComponent(eventTicker)}`, timeoutMs);
  const outcomes = [];
  for (const m of data.markets || []) {
    let p = Number(m.last_price_dollars);
    if (!isFinite(p) || p <= 0) {
      const bid = Number(m.yes_bid_dollars), ask = Number(m.yes_ask_dollars);
      if (isFinite(bid) && isFinite(ask) && ask > 0) p = (bid + ask) / 2;
    }
    if (!isFinite(p)) continue;
    outcomes.push({ name: clean(m.yes_sub_title || m.subtitle || m.ticker), prob: p });
  }
  if (!outcomes.length) throw new Error("no markets");
  if (outcomes.length === 1) outcomes[0].name = "Yes (passes)";
  outcomes.sort((a, b) => b.prob - a.prob);
  const series = eventTicker.split("-")[0].toLowerCase();
  return {
    source: "Kalshi",
    title: eventTicker,
    url: `https://kalshi.com/markets/${series}`,
    api: `${KS}/markets?event_ticker=${eventTicker}`,
    outcomes: outcomes.slice(0, 4),
    fetchedAt: new Date().toISOString(),
  };
}
