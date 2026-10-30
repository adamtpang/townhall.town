import { readFileSync, statSync, existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bandSources, motionAllowed, onIdleOrScroll, IDLE_FALLBACK_MS } from "../components/media/MediaBand";
import { vi } from "vitest";
import CityCards, { CITIES } from "../components/media/CityCards";
import { NumberedSection } from "../components/media/SectionHeader";
import { SectionBody } from "../components/Prose";
import { HOME_SECTIONS } from "../lib/content";

const src = (f: string) => readFileSync(f, "utf8");

describe("ndstudio-structure P0 (design, Oct 30 2026)", () => {
  it("home order: hero, ZIP, band, 01 Your city, 02 How it works, 03 Sources; locked H1 and tagline unchanged", () => {
    const p = src("app/page.tsx");
    const at = (s: string) => { const i = p.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const order = [at("Know your ballot in 2 minutes."), at("<BallotAgent />"), at("<MediaBand />"), at('n="01" label="Your city"'), at('n="02" label="How it works"'), at('n="03"')];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(p).toContain("<span>Get your person in office. </span>");
    expect(p).toContain("<T>Your vote matters.</T>");
  });
  it("02 How it works: exactly the 3 approved steps, numerals in brand-600, 3-up at md", () => {
    const p = src("app/page.tsx");
    for (const s of ["Enter your ZIP.", "Every race on your ballot.", "Read the sources.", "Every fact links its record.", "Go vote.", "When, where, what to bring."]) expect(p).toContain(`"${s}"`);
    expect(p).toContain("md:grid-cols-3");
    expect(p).toContain("text-brand-600");
  });
  it("numbered section: hairline rule, 96/64 rhythm, brand-700 tabular number, 14/20 label at 530", () => {
    const html = renderToStaticMarkup(createElement(NumberedSection, { n: "01", label: "Your city", id: "x", children: "c" }));
    for (const c of ["border-t border-ink/15", "pt-16", "lg:pt-24", "mt-16", "lg:mt-24", "md:col-span-4", "md:col-span-8", "text-brand-700", "tabular-nums", "text-sm leading-5 font-[530]"]) expect(html).toContain(c);
  });
  it("03 Sources keeps its content and links purple", () => {
    const s = HOME_SECTIONS.find((x) => x.heading === "Sources")!;
    const html = renderToStaticMarkup(createElement(SectionBody, { s }));
    const links = html.match(/<a [^>]*>/g)!;
    expect(links.length).toBe(11);
    for (const a of links) expect(a).toContain("th-link");
  });
  it("city cards: same ZIPs as the chips, one link per card, credits per spec §8", () => {
    expect(CITIES.map((c) => c.zip)).toEqual(["78701", "94103", "10001"]);
    const html = renderToStaticMarkup(createElement(CityCards));
    for (const z of ["78701", "94103", "10001"]) expect(html).toContain(`href="/?zip=${z}"`);
    expect(html).toContain("Photo: Daderot, CC0");
    expect(html).toContain("Photo: Bernard Spragg. NZ, CC0");
    expect(html).toMatch(/Photo: Jim Henderson, <a href="https:\/\/creativecommons.org\/licenses\/by\/4.0\/"[^>]*>CC BY 4.0.*<\/a>, modified \(duotone\)/);
    expect(html).toContain("flex-[0_0_72%] snap-start");
    expect(html).toContain("snap-x snap-mandatory");
    expect(html).not.toMatch(/src="https?:/); // self-hosted only
    expect(src("app/BallotAgent.tsx")).toContain('"townhall:zip"');
  });
  it("band: poster only under reduced motion or Save-Data; mobile WebM then MP4, desktop MP4", () => {
    expect(motionAllowed(false, false)).toBe(true);
    expect(motionAllowed(true, false)).toBe(false);
    expect(motionAllowed(false, true)).toBe(false);
    expect(bandSources(true).map((s) => s.src)).toEqual(["/media/band-mobile.webm", "/media/band-mobile.mp4"]);
    expect(bandSources(false).map((s) => s.src)).toEqual(["/media/band-desktop.mp4"]);
    const band = src("components/media/MediaBand.tsx");
    expect(band).not.toContain("rootMargin");
    expect(band).toMatch(/if \(!motionAllowed\(reduceMq\.matches, saveData\)\) return;/);
    expect(band).toContain('srcSet="/media/band-desktop-poster.jpg"');
    expect(band).toContain('src="/media/band-mobile-poster.jpg"');
    expect(band).toContain("h-11 w-11");
    expect(band).toMatch(/<video ref=\{v\} muted loop playsInline preload="none" aria-hidden="true"/);
    expect(band).not.toMatch(/<video[^>]*controls/);
  });
  it("media is self-hosted, budgeted, no image over 200 KB, no Vercel image optimizer", () => {
    const f = (n: string) => `public/media/${n}`;
    for (const n of ["band-desktop-poster.jpg", "band-mobile-poster.jpg", ...CITIES.flatMap((c) => [`${c.img}-600.webp`, `${c.img}-960.webp`])]) {
      expect(existsSync(f(n)), n).toBe(true);
      expect(statSync(f(n)).size, n).toBeLessThanOrEqual(200 * 1024);
    }
    expect(statSync(f("band-mobile.mp4")).size).toBeLessThanOrEqual(400 * 1024);
    expect(statSync(f("band-desktop.mp4")).size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    for (const c of ["components/media/CityCards.tsx", "components/media/MediaBand.tsx"]) expect(src(c)).not.toContain("next/image");
  });
  it("band video attaches once on idle or first scroll, whichever comes first; setTimeout fallback without rIC", () => {
    const mk = (ric: boolean) => {
      const ls: Record<string, () => void> = {};
      let idle: (() => void) | undefined;
      const w = {
        addEventListener: (n: string, f: () => void) => { ls[n] = f; },
        removeEventListener: (n: string) => { delete ls[n]; },
        ...(ric ? { requestIdleCallback: (f: () => void) => { idle = f; return 1; }, cancelIdleCallback: () => { idle = undefined; } } : {}),
      };
      return { w, ls, idle: () => idle?.() };
    };
    const a = mk(true); const runA = vi.fn();
    onIdleOrScroll(a.w as never, runA);
    expect(runA).not.toHaveBeenCalled();
    a.ls.scroll(); a.idle();
    expect(runA).toHaveBeenCalledTimes(1);
    const b = mk(true); const runB = vi.fn();
    onIdleOrScroll(b.w as never, runB);
    b.idle(); expect(runB).toHaveBeenCalledTimes(1); expect(b.ls.scroll).toBeUndefined();
    vi.useFakeTimers();
    const c = mk(false); const runC = vi.fn();
    onIdleOrScroll(c.w as never, runC);
    vi.advanceTimersByTime(IDLE_FALLBACK_MS - 1); expect(runC).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(runC).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
