// Polymarket strip (Oct 30, 2026): hidden on failure, both sides shown, link present, as-of present.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { buildStrip, stripIdsFor, STRIP_EVENTS, asOfCT, ROMERO_LINE, STRIP_LABEL, type LiveEvent } from "../lib/polyStrip";
import { loadStrip, PolyStripView, tickerSeconds } from "../components/PolyStrip";
import { ballotFor } from "../lib/tools";

const NOW = Date.parse("2026-10-30T20:05:00Z"); // 3:05 PM CT
const ev = (id: string, prices: [number, number][], servedAt = "2026-10-30T20:05:00Z"): LiveEvent => ({
  slug: STRIP_EVENTS[id].slug, servedAt,
  markets: Object.fromEntries(STRIP_EVENTS[id].markets.map((m, i) => [m.slug, { name: "", sides: [{ outcome: "Yes", prob: prices[i][0] }, { outcome: "No", prob: prices[i][1] }] }])),
});
const html = (s: ReturnType<typeof buildStrip>) => renderToStaticMarkup(createElement(PolyStripView, { strip: s }));
function gammaResponse(id: string, prices: [number, number][], date = "Fri, 30 Oct 2026 20:05:00 GMT") {
  const e = STRIP_EVENTS[id];
  return new Response(JSON.stringify([{ slug: e.slug, closed: false, markets: e.markets.map((m, i) => ({ slug: m.slug, active: true, closed: false, outcomes: '["Yes","No"]', outcomePrices: JSON.stringify(prices[i].map(String)) })) }]), { status: 200, headers: { date, "content-type": "application/json" } });
}
afterEach(() => vi.unstubAllGlobals());

describe("Polymarket strip", () => {
  it("uses Civic's markets: ca-gov has only Becerra and Hilton, ca-ltgov is never in the strip, only the 3 ZIPs", () => {
    expect(STRIP_EVENTS["ca-gov"].markets.map((m) => m.slug)).toEqual(["will-xavier-becerra-win-the-california-governor-election-in-2026", "will-steve-hilton-win-the-california-governor-election-in-2026"]);
    expect(STRIP_EVENTS["ca-ltgov"]).toBeUndefined();
    expect(new Set(Object.values(STRIP_EVENTS).map((e) => e.zip))).toEqual(new Set(["78701", "94103", "10001", "national"]));
    expect(stripIdsFor(ballotFor("94103"))).toEqual(["ca-gov", "ca-prop-1", "ca-prop-2"]);
    expect(stripIdsFor(ballotFor("78701"))).toEqual(["tx-10", "tx-37", "us-senate-tx"]);
    expect(stripIdsFor(ballotFor("10001"))).toEqual(["ny-12", "ny-governor", "ny-attorney-general"]);
    expect(stripIdsFor(null)).toEqual(["national-senate", "national-house"]);
    expect(ballotFor("77002")).toBeNull();
  });

  it("is hidden when the fetch fails, when data is missing and when data is over 1 hour old", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await loadStrip(null, NOW)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 503 })));
    expect(await loadStrip(null, NOW)).toBeNull();
    expect(html(null)).toBe("");
    expect(buildStrip(["national-senate"], {}, null, NOW)).toBeNull();
    expect(buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]], "2026-10-30T19:04:00Z") }, null, NOW)).toBeNull();
    // A market missing its No side drops the chip: never a lone side.
    const half = ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]);
    half.markets[STRIP_EVENTS["national-senate"].markets[0].slug].sides.pop();
    expect(buildStrip(["national-senate"], { "national-senate": half }, null, NOW)).toBeNull();
  });

  it("shows Yes and No for every market, the event link and the as-of time (12-hour CT, from the response Date header)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init: { next?: { revalidate?: number } }) => {
      calls.push(`${u} ${init?.next?.revalidate}`);
      const id = u.includes("senate") ? "national-senate" : "national-house";
      return gammaResponse(id, [[0.295, 0.705], [0.705, 0.295]]);
    }));
    const s = await loadStrip(null, NOW);
    expect(calls.every((c) => c.endsWith(" 300"))).toBe(true);
    expect(s?.asOfLabel).toBe("3:05 PM CT");
    const out = html(s);
    expect(out).toContain("as of 3:05 PM CT");
    // Adam 3:02 label, visible and as the accessible name; the time appears once in the strip row.
    const text = out.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");
    expect(text).toContain("Polymarket prices (market price, not a poll or forecast) · as of 3:05 PM CT");
    expect(out).toContain('aria-label="Polymarket prices (market price, not a poll or forecast) · as of 3:05 PM CT"');
    expect(out).toContain('href="https://polymarket.com"');
    expect(out).toContain('href="https://polymarket.com/event/which-party-will-win-the-senate-in-2026"');
    expect(out).toMatch(/target="_blank" rel="noopener"/);
    expect(out).toContain("Which party will win the Senate in 2026?");
    expect(out).toContain("· 2 markets");
    expect((out.match(/Yes 30% · No 71%|Yes 71% · No 30%/g) || []).length).toBe(4);
    expect(out).toContain("↗");
    expect(out).not.toMatch(/ballot order/i);
  });

  it("single-market measures are one link with both sides; CA candidates sort by last name", () => {
    const b = ballotFor("94103");
    const s = buildStrip(["ca-gov", "ca-prop-1"], { "ca-gov": ev("ca-gov", [[0.9755, 0.0245], [0.0245, 0.9755]]), "ca-prop-1": ev("ca-prop-1", [[0.62, 0.38]]) }, b, NOW)!;
    expect(s.chips[0].rows.map((r) => r.question)).toEqual(["Will Xavier Becerra win the California Governor Election in 2026?", "Will Steve Hilton win the California Governor Election in 2026?"]);
    const out = html(s);
    expect(out).toContain("California Affordable Housing Bond Proposition</span>: Yes 62% · No 38% ↗");
    expect(out).toContain('href="https://polymarket.com/event/california-affordable-housing-bond-proposition"');
  });

  it("TX party markets follow the site's candidate order for the race", () => {
    const s = buildStrip(["tx-10"], { "tx-10": ev("tx-10", [[0.915, 0.085], [0.09, 0.91]]) }, ballotFor("78701"), NOW)!;
    // batch1 merge: the ballot follows Civic's official order (Gober, Republican, then Rourk, Democratic); the strip follows it
    const first = (ballotFor("78701")!.races.find((r) => r.id === "tx-10")!.candidates[0].party);
    expect(first).toBe("Republican");
    expect(s.chips[0].rows[0].question).toMatch(/Republican/);
  });

  it("design rules: 44/48px, 14px, min-h-11 targets, scoped blue token, no party colors, Romero line on", () => {
    const s = buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const out = html(s);
    // 48px row at lg; on phones the 3:02 label may wrap to 2 lines (Adam OK 3:26), so the strip grows from 44px rows.
    expect(out).toMatch(/lg:h-12/);
    expect(out).toMatch(/data-strip-label/);
    expect(out).toContain("text-sm");
    expect(out).toContain("min-h-11");
    // Ticker (3:35 PM): the viewport clips (overflow-x-hidden) and contains the absolute sr-only spans, so the page
    // never overflows at 320/390; reduced motion switches it to overflow-x:auto with snap (globals.css).
    expect(out).toMatch(/<div class="relative [^"]*overflow-x-hidden[^"]*" data-strip-scroller/);
    // Design 3:06: links are ink with an underline, never the site purple or blue (global a is brand-700).
    for (const a of out.match(/<a [^>]*>/g) || []) expect(a).toContain("text-ink hover:text-ink");
    expect(out).not.toMatch(/(text|bg)-(red|blue|green|rose|sky)-/);
    expect(ROMERO_LINE).toBe(true);
    expect(STRIP_LABEL).toBe("Polymarket prices (market price, not a poll or forecast)");
    expect(readFileSync("app/globals.css", "utf8")).toMatch(/\[data-poly-strip\] \{ --market-bg: #EEF4FB; --market-border: #D3E2F4; --market-mark: #3B6FB6; \}/);
    expect(asOfCT("2026-10-30T20:05:00Z")).toBe("3:05 PM CT");
  });
});

describe("strip ticker (Adam 3:35 PM: sliding like a news banner)", () => {
  const two = () => buildStrip(["national-senate", "national-house"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]), "national-house": ev("national-house", [[0.4, 0.6], [0.6, 0.4]]) }, null, NOW);
  it("label stays outside the moving track; the duplicate set is aria-hidden with every control at tabindex -1", () => {
    const s = two() ?? buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const out = html(s);
    const track = out.slice(out.indexOf("data-strip-track"));
    expect(out.indexOf("data-strip-label")).toBeLessThan(out.indexOf("data-strip-track"));
    expect(track).not.toContain("data-strip-label");
    const dup = out.match(/<ul[^>]*aria-hidden="true"[^>]*data-strip-dup[^>]*>([\s\S]*?)<\/ul>/);
    expect(dup).toBeTruthy();
    const ctrls = dup![1].match(/<(a|button) [^>]*>/g) || [];
    expect(ctrls.length).toBe(s!.chips.length);
    for (const c of ctrls) expect(c).toContain('tabindex="-1"');
    expect(dup![1]).not.toMatch(/popover="auto"|id="pm-/);
    // the real set stays keyboard-reachable
    const real = out.match(/<ul[^>]*data-strip-set[^>]*>([\s\S]*?)<\/ul>/)![1];
    for (const c of real.match(/<(a|button) [^>]*>/g) || []) expect(c).not.toContain("tabindex");
    expect(out).toMatch(/--ticker-dur:\d+s/);
  });
  it("plain CSS loop with pause on hover/focus; reduced motion is static, scrollable and drops the duplicate", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/@keyframes poly-ticker \{ from \{ transform: translateX\(0\); \} to \{ transform: translateX\(-50%\); \} \}/);
    expect(css).toMatch(/\[data-strip-scroller\]:hover \[data-strip-track\], \[data-strip-scroller\]:focus-within \[data-strip-track\] \{ animation-play-state: paused; \}/);
    const rm = css.slice(css.indexOf("[data-strip-track] { animation: none"));
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n  \[data-strip-track\] \{ animation: none !important; transform: none; \}\n  \[data-strip-dup\] \{ display: none; \}\n  \[data-strip-scroller\] \{ overflow-x: auto;/);
    expect(rm.length).toBeGreaterThan(0);
  });
  it("speed stays readable: ~40-60px/s", () => {
    const s = two() ?? buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const secs = tickerSeconds(s!.chips);
    const chars = s!.chips.reduce((n, c) => n + c.title.length + 30, 0);
    expect(secs).toBeGreaterThanOrEqual(10);
    expect((chars * 7.6) / secs).toBeLessThan(80);
  });
});

describe("ticker pause control (WCAG 2.2.2, Design 3:43 PM)", () => {
  it("icon-only toggle: aria-label Pause/Play prices with aria-pressed, 44x44, state on the strip", async () => {
    const { tickerToggleProps, applyPaused } = await import("../components/TickerToggle");
    expect(tickerToggleProps(false)).toEqual({ "aria-label": "Pause prices", "aria-pressed": false });
    expect(tickerToggleProps(true)).toEqual({ "aria-label": "Play prices", "aria-pressed": true });
    const s = buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const out = html(s);
    const btn = out.match(/<button[^>]*data-strip-toggle[^>]*>([\s\S]*?)<\/button>/);
    expect(btn).toBeTruthy();
    expect(btn![0]).toContain('aria-label="Pause prices"');
    expect(btn![0]).toContain('aria-pressed="false"');
    expect(btn![0]).toMatch(/h-11 w-11/);
    expect(btn![1].replace(/<[^>]+>/g, "").trim()).toBe(""); // no visible text
    // toggling sets/clears data-strip-paused on the strip element
    const attrs = new Set<string>();
    const strip = { setAttribute: (k: string) => attrs.add(k), removeAttribute: (k: string) => attrs.delete(k) };
    const el = { closest: (sel: string) => (sel === "[data-poly-strip]" ? strip : null) } as unknown as Element;
    applyPaused(el, true); expect(attrs.has("data-strip-paused")).toBe(true);
    applyPaused(el, false); expect(attrs.has("data-strip-paused")).toBe(false);
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("[data-strip-paused] [data-strip-track] { animation-play-state: paused; }");
  });
  it("toggle hidden under reduced motion; left fade ~24px at the label edge", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const rm = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  [data-strip-track]"));
    expect(rm.slice(0, rm.indexOf("}\n}") + 3)).toContain("[data-strip-toggle] { display: none; }");
    const s = buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    expect(html(s)).toContain("mask-image:linear-gradient(to_right,transparent,#000_24px,");
  });
});

describe("strip QA P2s (3:46 PM): measured speed, focus ring, 400% zoom", () => {
  it("duration is set from the measured set width at 50px/s", async () => {
    const { tickerDuration, TICKER_PX_PER_S } = await import("../components/TickerToggle");
    expect(TICKER_PX_PER_S).toBe(50);
    expect(tickerDuration(2000)).toBe(40);
    expect(tickerDuration(100)).toBe(10); // floor for a tiny set
  });
  it("chips carry a 2px solid ink ring with 2px offset, and the scroller leaves room so it is not clipped", () => {
    const s = buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const out = html(s);
    const chip = out.match(/<(a|button)[^>]*data-strip-chip[^>]*>/)![0];
    for (const c of ["focus-visible:outline", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ink"]) expect(chip).toContain(c);
    expect(out).toMatch(/class="relative -my-1 [^"]*py-1[^"]*" data-strip-scroller/);
  });
  it("label is clamped to 2 lines (as at 390) and chips stay one row, so 400% zoom adds no strip height", () => {
    const s = buildStrip(["national-senate"], { "national-senate": ev("national-senate", [[0.3, 0.7], [0.7, 0.3]]) }, null, NOW);
    const out = html(s);
    expect(out).toMatch(/<span class="min-w-0 line-clamp-2"><a href="https:\/\/polymarket.com"/);
    expect(out).toMatch(/class="flex w-max items-center whitespace-nowrap" data-strip-track/);
  });
});
