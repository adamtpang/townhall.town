import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { H1, H2, H3, HIT } from "../lib/typeScale";
import { Progress } from "../components/ui/progress";
import { SectionBlock } from "../components/Prose";
import { HOME_SECTIONS } from "../lib/content";
import { voteMatters } from "../lib/voteMatters.mjs";

const src = (f: string) => readFileSync(f, "utf8");

describe("Design p7 (4c21a5c)", () => {
  it("1. heading scale: H1 56/40, H2 40/28 at 530 / -0.02em, H3 24/20 at 530", () => {
    expect(H1).toMatch(/text-\[40px\]/); expect(H1).toMatch(/md:text-\[56px\]/); expect(H1).toMatch(/font-\[530\]/);
    expect(H2).toMatch(/(^| )text-\[28px\]/); expect(H2).toMatch(/md:text-\[40px\]/); expect(H2).toMatch(/font-\[530\]/); expect(H2).toMatch(/tracking-\[-0\.02em\]/);
    expect(H3).toMatch(/(^| )text-xl/); expect(H3).toMatch(/md:text-2xl/); expect(H3).toMatch(/font-\[530\]/);
    // Every block title uses the shared H2, the end-screen subheads use H3, home and /card share H1.
    for (const f of ["app/RaceTiers.tsx", "app/IssueMatch.tsx", "app/EndScreen.tsx"]) {
      expect(src(f)).toMatch(/<h2 className=\{`mt-3 \$\{H2\}`\}>/);
      expect(src(f)).not.toMatch(/<h2[^>]*md:text-\[56px\]/);
    }
    expect(src("app/EndScreen.tsx").match(/<h3 className=\{`mt-2 \$\{H3\}`\}>/g)).toHaveLength(3);
    expect(src("app/page.tsx")).toMatch(/<h1 className=\{`\$\{H1\}/);
    expect(src("app/card/BallotCard.tsx")).toMatch(/<h1 className=\{`mt-3 \$\{H1\}`\}>/);
    expect(src("app/card/BallotCard.tsx")).not.toMatch(/text-5xl tracking-tight/);
    expect(src("tailwind.config.ts")).toContain("./lib/typeScale.ts"); // classes in the token file must be generated
  });
  it("2. 45ch line length (design p8 narrowed from 65ch) on reason, judicial note, How it works and Sources", () => {
    expect(src("app/IssueMatch.tsx")).toMatch(/<p className="mt-1 max-w-\[45ch\] text-sm text-black\/60" data-reason>/);
    expect(src("app/EndScreen.tsx")).toMatch(/<p className="mt-4 max-w-\[45ch\] text-sm text-black\/60" data-judicial-note>/);
    for (const h of ["How it works", "Sources"]) {
      const s = HOME_SECTIONS.find((x) => x.heading === h)!;
      const html = renderToStaticMarkup(createElement(SectionBlock, { s }));
      const blocks = html.match(/<(p|ul)( class="[^"]*")?>/g)!;
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) expect(b).toContain("max-w-[45ch]");
    }
  });
  it("3. progress bar: square black/10 track, black fill", () => {
    const html = renderToStaticMarkup(createElement(Progress, { value: 40 }));
    expect(html).toContain("rounded-none"); expect(html).toContain("bg-black/10"); expect(html).toMatch(/class="h-full bg-black /);
    expect(html).not.toMatch(/rounded-full|bg-slate-600|bg-slate-200/);
  });
  it("4. pseudo hit areas on How, Early voting source, photo credits and news links (round 0222: 28px, sized so neighbours never overlap; design p12 tap test)", () => {
    expect(HIT).toBe("relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']");
    const end = src("app/EndScreen.tsx");
    expect(end).toMatch(/className=\{`\$\{HIT\} th-link`\} data-how-register>How ↗/);
    expect(end).toMatch(/after:-inset-y-1 after:content-\[''\]" data-early-source>Early voting source/);
    expect(end).not.toMatch(/after:-inset-y-4|after:-inset-x-3/);
    // Oct 29 11:42 PM CT: attribution is always visible, small and muted (was a blue link in a collapsed list).
    // Design p10 supersedes: credit is 12/16 weight 450 black/60, author linked to the file page, license to its deed.
    expect(src("components/Portrait.tsx")).toMatch(/CREDIT = "max-w-\[60ch\] text-\[12px\] leading-4 font-\[450\] text-black\/60/);
    expect(src("app/RaceTiers.tsx")).toMatch(/className=\{`\$\{HIT\} text-black underline-offset-2 hover:underline`\} data-news-link>/);
  });
  it("5. ballot starts mt-6 below the city chips (no ~100px band)", () => {
    const b = src("app/BallotAgent.tsx");
    expect(b).toContain('<div id="ballot" className="mt-6">');
    expect(b).not.toContain('<div id="ballot" className="mt-32">');
  });
  it("6. SF stat drops '(Census estimate)'; the Census ACS link stays", () => {
    const v = voteMatters("94103")!;
    expect(v.text).not.toMatch(/Census estimate/);
    expect(v.sources.some((s: { label: string }) => s.label === "Census ACS 2024")).toBe(true);
  });
});
