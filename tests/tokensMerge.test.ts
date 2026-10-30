import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { STRIP_LABEL } from "../lib/polyStrip";
const tok = (s: string) => (s.match(/--(brand|ink|purple)[a-z0-9-]*:\s*[^;]+;/g) || []).join("\n");
describe("batch1 + poly-banner merge keeps both token sets", () => {
  it("purple brand tokens are unchanged against af307d2", () => {
    let base = "";
    try { base = execSync("git show af307d2:app/globals.css", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return; } // no git history (deploy build)
    expect(tok(readFileSync("app/globals.css", "utf8"))).toBe(tok(base));
    expect(readFileSync("tailwind.config.ts", "utf8")).toBe(execSync("git show af307d2:tailwind.config.ts", { encoding: "utf8" }));
  });
  it("the strip's blue market tokens are present and the label is non-empty", () => {
    expect(readFileSync("app/globals.css", "utf8")).toMatch(/\[data-poly-strip\]\s*\{\s*--market-bg: #EEF4FB;/);
    expect(STRIP_LABEL).toBe("Polymarket prices (market price, not a poll or forecast)");
    expect(readFileSync("components/PolyStrip.tsx", "utf8")).toContain("{` · as of ${strip.asOfLabel}`}");
  });
});
