import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { plain } from "../lib/plain";
import { ballotFor } from "../lib/tools";

const src = (p: string) => fs.readFileSync(p, "utf8");

describe("QA 9dfe90d P1-2: 10001 source notes all say 'draft, printed 9/11/2026'", () => {
  it("plain() adds 'printed' for the short form and keeps it for the long form", () => {
    expect(plain("Source: NYC BOE contest list (TENTATIVE, 9/11/2026)")).toBe("Source: NYC Board of Elections contest list (draft, printed 9/11/2026)");
    expect(plain("Source is the NYC BOE contest list (marked TENTATIVE, printed 9/11/2026)")).toBe("Source is the NYC Board of Elections contest list (draft, printed 9/11/2026)");
  });
  it("every 10001 race note that cites the contest list reads 'draft, printed 9/11/2026'", () => {
    const b: any = ballotFor("10001");
    const ids = ["ny-civil-county-ny", "ny-civil-3md-ny", "ny-civil-9md-ny", "nyc-council-3"];
    for (const id of ids) {
      const r = b.races.find((x: any) => x.id === id);
      expect(r, id).toBeTruthy();
      expect(r.sourceNote, id).toContain("printed 9/11/2026. Every page is still marked TENTATIVE"); // Civic qa_fixes4 keeps TENTATIVE
    }
    for (const r of b.races.filter((x: any) => /9\/11\/2026/.test(x.appliesNote || "") && !x.sourceNote)) expect(plain(r.appliesNote), r.id).toContain("draft, printed 9/11/2026");
  });
});

describe("QA 9dfe90d P2: research cache header reports the real layer", () => {
  it("route sets hit/partial/miss from the per-search and per-page caches, and layer names", () => {
    const s = src("app/api/research/route.ts");
    expect(s).toMatch(/need && have === need \? "hit" : have \? "partial" : "miss"/);
    expect(s).toMatch(/"x-research-cache-layer": "run"/);
    expect(s).toMatch(/"x-research-cache-layer": layer === "miss" \? "none" : "search\+pages"/);
  });
});
