// Audit 3:05 PM CT (Oct 30): no text under 14px, no tap target under 44px at 390.
// Static guard here; the computed-style check at 390 is shottool/sizecheck.mjs (run against the preview).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(p) ? [p] : []; });
const files = ["app", "components", "lib"].flatMap(walk);

describe("size floor", () => {
  it("text-xs is floored at 14px", () => {
    const tw = readFileSync(readdirSync(".").find((f) => f.startsWith("tailwind.config"))!, "utf8");
    expect(tw).toMatch(/xs: \["14px"/);
  });
  it("no arbitrary font size under 14px in screen styles", () => {
    const bad = files.filter((f) => /text-\[(?:[0-9]|1[0-3])px\]|text-\[0?\.[0-7]\d*rem\]/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("every link, button and summary gets a 44x44 floor on screen", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/:where\(main, header, footer, nav\) :where\(a\[href\], button, summary\) \{ min-height: 44px; min-width: 44px; \}/);
  });
});
