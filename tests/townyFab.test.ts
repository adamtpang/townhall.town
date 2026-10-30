import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as chat from "../lib/townyChat";
import { FAQS, faqFor, whenWhere, WHO_LINE } from "../lib/towny/faq";
import { townyBrief, TOWNY_BRIEF } from "../lib/towny/brief";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NEW = ["components/towny/TownyFab.tsx", "components/towny/TownyMark.tsx", "lib/townyChat.ts", "lib/towny/faq.ts", "lib/towny/brief.ts"];
const EMOJI = /\p{Extended_Pictographic}/u;

describe("Towny floating button and panel", () => {
  const fab = src("components/towny/TownyFab.tsx");
  it("button: aria-label Ask Towny, 56px square, primary, z-40, safe-area bottom", () => {
    expect(chat.TOWNY_LABEL).toBe("Ask Towny");
    expect(fab).toContain("aria-label={TOWNY_LABEL}");
    for (const c of ["h-14 w-14", "rounded-none", "bg-primary", "text-primary-foreground", "z-40", "right-4", "lg:right-6", "env(safe-area-inset-bottom)", "--k", "--towny-face", "hsl(var(--primary))", "hsl(var(--background))"]) expect(fab).toContain(c);
    expect(fab).not.toMatch(/animate-bounce|animate-ping|badge/);
  });
  it("panel: dialog, Esc, focus trap, live region, sheet on phones and 400x640 at lg", () => {
    for (const c of ['role="dialog"', 'aria-modal="true"', 'aria-label="Towny chat"', '"Escape"', '"Tab"', 'aria-live="polite"', "h-[85dvh]", "lg:w-[400px]", "lg:h-[640px]", "lg:max-h-[calc(100dvh-48px)]", "lg:shadow-lg", "h-16", "h-11 w-11", "max-w-[85%]", "bg-muted px-4 py-3", "motion-safe:animate-pulse", "border-t"]) expect(fab).toContain(c);
  });
  it("one mark component (C) used for button and header; old clock-tower mark not in the build", () => {
    expect(fab.match(/<TownyMark /g)?.length).toBe(2);
    const m = src("components/towny/TownyMark.tsx");
    expect(m).toContain('data-towny-mark="c"'); expect(m).toContain('viewBox="0 0 64 64"'); expect(m).toContain("var(--k"); expect(m).toContain("currentColor");
    expect(fab).toContain("<TownyMark size={36} />"); expect(fab).toContain("<TownyMark size={40}");
  });
  it("page mounts it and gives main bottom room on phones", () => {
    const p = src("app/page.tsx");
    expect(p).toContain("<TownyFab />");
    expect(p).toContain("pb-24 lg:pb-0");
  });
  it("copy strings (Civic, 1:16 PM CT)", () => {
    expect(chat.TOWNY_OPENER).toBe("Hi, I'm Towny. What do you want to know about your ballot in Austin, San Francisco or New York City?");
    expect(chat.TOWNY_CAPTION).toBe("Nonpartisan. Every fact links its source.");
    expect(chat.WHO_TO_VOTE_REPLY).toBe("I don't pick for you. I can show where each candidate's sourced positions overlap with your answers.");
    expect(chat.TOWNY_SUGGESTIONS).toEqual(["What's on my ballot?", "Where do I vote?", "Help me think through an issue"]);
    expect(chat.PLACEHOLDER).toBe("Ask about your ballot");
  });
  it("who to vote for: fixed reply with the overlap chip, never a pick", () => {
    for (const q of ["Who should I vote for?", "who do you recommend for mayor", "Which candidate should I pick?"]) {
      const r = chat.routeTurn(q, "78701");
      expect(r.kind).toBe("fixed");
      if (r.kind === "fixed") { expect(r.reply).toBe(WHO_LINE); expect(r.chips).toEqual([chat.WHO_CHIP]); }
    }
  });
  it("only 78701, 94103, 10001; anything else gets exactly the scope line; Houston stays hidden", () => {
    for (const q of ["77002", "my zip is 90012", "What's on my ballot in Houston?", "Dallas", "Chicago ballot"]) {
      const r = chat.routeTurn(q, null);
      expect(r.kind === "fixed" && r.reply).toBe("Towny covers Austin (78701), San Francisco (94103) and New York City (10001) right now. For your ballot, check vote.gov.");
      expect(r.kind === "fixed" && r.links?.map((l) => l.url)).toEqual(["https://vote.gov"]);
    }
    for (const z of ["78701", "94103", "10001"]) expect(chat.routeTurn(z, null).kind).toBe("fixed");
    expect(chat.routeTurn("What's on my ballot?", "94103").kind).toBe("ask");
    for (const f of NEW) expect(src(f)).not.toMatch(/77002/);
  });
});

describe("Towny FAQ and brief", () => {
  it("has the seven questions and each factual answer links a source (who-to-vote is a refusal, no facts)", () => {
    expect(FAQS.map((f) => f.q)).toEqual(["How are candidates matched?", "Where does the data come from?", "Is it partisan?", "Why only 3 ZIPs?", "How do I add my city?", "Who should I vote for?", "When and where do I vote?"]);
    for (const f of FAQS) { const a = faqFor(f.q, "78701", "2026-10-30")!; expect(a.a.length).toBeGreaterThan(20); if (f.id === "who") { expect(a.a).toBe(WHO_LINE); continue; } expect(a.links.length).toBeGreaterThan(0); for (const l of a.links) expect(l.url).toMatch(/^https:\/\//); }
  });
  it("matching answer: Civic's exact line (1:38 PM CT), overlap on a -2 to +2 scale, no grades", () => {
    const a = faqFor("How are candidates matched?", null)!.a;
    expect(a).toBe("It shows where each candidate's sourced positions overlap with your answers, which you give on a -2 to +2 scale.");
  });
  it("when and where: Election Day, official office link, early voting date-aware, no hours", () => {
    const tx = whenWhere("78701", "2026-10-30");
    expect(tx.a).toMatch(/Tuesday, November 3, 2026/); expect(tx.a).toMatch(/today/i);
    expect(tx.links.map((l) => l.url)).toContain("https://votetravis.gov");
    expect(whenWhere("78701", "2026-10-31").a).toMatch(/ended/);
    expect(whenWhere("94103", "2026-10-30").links.map((l) => l.url)).toContain("https://www.sf.gov/departments/department-elections");
    expect(whenWhere("10001", "2026-10-30").links.map((l) => l.url)).toContain("https://vote.nyc");
    expect(tx.a).not.toMatch(/\d{1,2}(:\d\d)? ?(a\.?m|p\.?m)/i);
  });
  it("add my city: GitHub issues, no timeline promised", () => {
    const a = faqFor("How do I add my city?", null)!;
    expect(a.links.some((l) => /github\.com\/.+\/issues/.test(l.url))).toBe(true);
    expect(a.a).not.toMatch(/\b(soon|next month|by (january|february|march|spring|summer))\b/i);
  });
  it("brief: what it is, who built it, ZIPs, privacy, nonpartisan, open source; FEC money only with the flag", () => {
    for (const s of ["Adam Pang", "AITX Hack Fair", "Antler", "78701", "94103", "10001", "Polymarket", "Google Calendar", "github.com/"]) expect(TOWNY_BRIEF).toContain(s);
    expect(TOWNY_BRIEF).toMatch(/never (shared|sold)|not (shared|sold)/i);
    expect(townyBrief(false)).not.toMatch(/FEC money|campaign money/i);
    expect(townyBrief(true)).toMatch(/FEC/);
    // lib/api/agent.ts is Claude's (no-touch on feat/towny-fab-v3, 9229c66): the brief is used by Towny's own routes, not the ballot agent.
    expect(src("lib/api/agent.ts")).toContain("townyPrompt(");
  });
  it("new files: no letter grades, no emoji, no 10-12px text", () => {
    for (const f of NEW) {
      const s = src(f);
      expect(s, f).not.toMatch(/text-xs|text-\[1[0-2]px\]|text-\[11px\]/);
      expect(s.replace(/↗/g, ""), f).not.toMatch(EMOJI);
      expect(s, f).not.toMatch(/\bgrade[sd]? [A-F]\b|\b[A-F][+-]? grade\b/);
    }
  });
});
