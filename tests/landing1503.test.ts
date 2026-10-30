import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Design landing spec P0 (Oct 30, 3:03 PM) + audit 3:05 PM", () => {
  it("band is full-bleed without w-screen (no scrollbar-gutter overflow) and sits outside the 1280 container", () => {
    const b = src("components/media/MediaBand.tsx");
    expect(b).not.toMatch(/className="[^"]*(w-screen|50vw)/);
    expect(b).toContain('<figure className="relative mt-4 w-full" data-media-band>');
    const p = src("app/page.tsx");
    expect(p).toMatch(/<\/div>\s*<MediaBand \/>\s*<div className="mx-auto max-w-\[1280px\] px-5 md:px-10">/);
  });
  it("band caption on a dark glass plate with white text and a 44px pause button using the existing strings", () => {
    const b = src("components/media/MediaBand.tsx");
    expect(b).toMatch(/<figcaption className="absolute inset-x-0 bottom-0 bg-ink\/55[^"]*text-white/);
    expect(b).toContain('aria-label={paused ? "Play background video" : "Pause background video"}');
    expect(b).toMatch(/h-11 w-11[^"]*text-white/);
    expect(b).toContain('alt="" aria-hidden="true"');
  });
  it("header is 56px on phones, 64px on desktop; Español toggle stays", () => {
    expect(src("components/SiteChrome.tsx")).toMatch(/<header className="[^"]*h-14[^"]*lg:h-16[^"]*"/);
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
