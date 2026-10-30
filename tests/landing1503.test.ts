import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Design landing spec P0 (Oct 30, 3:03 PM) + audit 3:05 PM", () => {
  it("band is full-bleed without w-screen (no scrollbar-gutter overflow) and sits outside the 1280 container", () => {
    const b = src("components/media/MediaBand.tsx");
    expect(b).not.toMatch(/className="[^"]*(w-screen|50vw)/);
    // v3.1 merge: motion-v2's band (Design GO, fe2ac42): no top margin, caption row below the band.
    expect(b).toContain('<figure className="w-full" data-media-band>');
    const p = src("app/page.tsx");
    expect(p).toMatch(/<\/div>\s*<MediaBand \/>\s*<div className="mx-auto max-w-\[1280px\] px-5 md:px-10">/);
  });
  it("band caption (motion-v2, Design GO fe2ac42: a caption row under the band, no text on media) with a 44px pause button using the existing strings", () => {
    const b = src("components/media/MediaBand.tsx");
    expect(b).toMatch(/<figcaption className="mx-auto mt-3 flex max-w-\[1280px\][^"]*text-ink\/60/);
    expect(b).toContain('aria-label={paused ? "Play background video" : "Pause background video"}');
    expect(b).toMatch(/h-11 w-11[^"]*text-ink/);
    expect(b).toContain('alt="" aria-hidden="true"');
  });
  it("header is 56px (motion-v2 glass bar, Design premium §1); Español toggle stays", () => {
    expect(src("components/SiteChrome.tsx")).toMatch(/<header className="[^"]*min-h-14[^"]*"/);
    expect(src("components/SiteChrome.tsx")).not.toMatch(/<header className="[^"]*py-8/);
    expect(src("app/page.tsx")).toContain("<SiteHeader extra={<LangToggle />} />");
  });
  it("contrast: date and listed muted text at ink/60, placeholder ink/50", () => {
    expect(src("components/SiteChrome.tsx")).toContain('text-ink/60">{SITE.electionLabel}');
    expect(src("components/ui/input.tsx")).toContain("placeholder:text-ink/50");
    for (const f of ["components/SiteChrome.tsx", "app/LocalNews.tsx", "app/Plan.tsx", "app/not-found.tsx"]) expect(src(f), f).not.toMatch(/text-black\/(50|35)/);
    expect(src("app/RaceTiers.tsx")).not.toMatch(/tracking-wide text-black\/50/);
  });
  it("tagline stays 530; no credits page", () => {
    expect(src("app/page.tsx")).toMatch(/font-\[530\][^"]*" data-tagline/);
    expect(() => src("app/credits/page.tsx")).toThrow();
  });
  it("audit (c): an uncovered ZIP's /card 307 lands on /?zip=, which shows the existing notice and the 3 city buttons", () => {
    expect(src("app/card/page.tsx")).toContain('redirect(zip ? `/?zip=${zip}` : "/")');
    const a = src("app/BallotAgent.tsx");
    expect(a).toContain("{(result || notice === UNSUPPORTED) && <div className=\"mt-4 flex flex-wrap gap-2\" data-city-buttons>");
    expect(a).toContain("if (!SUPPORTED.has(z)) { setZip(z); return setNotice(UNSUPPORTED); }");
  });
});

import { afterLoadThenInteraction } from "../components/media/MediaBand";
describe("video waits for the first interaction (first load ~0.4 MB)", () => {
  it("never fires on load or idle alone; fires once on the first scroll/pointer/key after load", () => {
    const ls: Record<string, () => void> = {};
    const w = { document: { readyState: "interactive" }, addEventListener: (n: string, f: () => void) => { ls[n] = f; }, removeEventListener: (n: string) => { delete ls[n]; }, requestIdleCallback: () => 1 };
    const run = vi.fn();
    afterLoadThenInteraction(w as never, run);
    ls.scroll?.(); expect(run).not.toHaveBeenCalled(); // before load
    ls.load(); expect(run).not.toHaveBeenCalled();
    ls.keydown(); expect(run).toHaveBeenCalledTimes(1);
    expect(ls.scroll).toBeUndefined();
  });
});
