"use client";
import { useT } from "../lib/i18n";

type Step = { tool: string; status: "running" | "done"; summary?: string; ms?: number };
/** Server-built summary bullet (lib/api/agent.ts SummaryBullet): sourced, two-sided for markets. */
export type SummaryBullet = { kind: "market" | "measure" | "census"; text: string; sourceUrl: string | null; whatChanges?: string | null; whatChangesSourceUrl?: string | null };

const LABEL: Record<string, string> = {
  getDistricts: "Found your districts",
  getRaces: "Listed every race and measure",
  getCandidates: "Looked up the candidates",
  getMarketOdds: "Checked live Polymarket prices",
  getLocalProblems: "Pulled local Census data",
  analyze: "Analyzed what matters",
};
const SOURCE: Record<string, string> = {
  getDistricts: "Census ZCTA and state district maps",
  getRaces: "Ballotpedia and official election offices",
  getCandidates: "Ballotpedia, FEC, state ethics filings",
  getMarketOdds: "Polymarket live API",
  getLocalProblems: "Census ACS 5-year",
  analyze: "the tool results above, plus official measure costs",
};
const SOURCE_LINK: Record<SummaryBullet["kind"], string> = { market: "Polymarket", measure: "Official cost", census: "Census table" };

// Bullet text arrives as "- ... Source: <url>"; the list supplies the bullet and the link, so strip both from the text.
const bulletText = (s: string) => s.replace(/^\s*-\s*/, "").replace(/\s*Source:\s*\S+\s*$/, "").trim();

/** The agent's work, shown: every tool call, what it returned, how long it took, and whether the model chose it. */
export default function AgentTrace({
  tools,
  steps,
  byModel,
  narration,
  bullets,
  seconds,
}: {
  tools: string[];
  steps: Record<string, Step>;
  byModel: string[];
  narration: string;
  bullets?: SummaryBullet[];
  seconds: number | null;
}) {
  const t = useT();
  const done = tools.filter((k) => steps[k]?.status === "done");
  if (!done.length) return null;
  return (
    <details open className="mt-6 border-t border-navy-700 pt-4" data-agent-trace>
      <summary className="flex min-h-11 cursor-pointer flex-col items-start gap-1 text-sm text-black/70 md:flex-row md:items-center md:gap-3">
        <span className="font-[530] text-black">{t("How the agent built this")}</span>
        <span className="tabular-nums">
          {done.length} {t("tool calls")}
          {seconds != null ? ` · ${seconds.toFixed(1)}s` : ""}
        </span>
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {done.map((k) => {
          const s = steps[k];
          return (
            <li key={k} className="grid grid-cols-1 gap-1 sm:grid-cols-12">
              <span className="text-black sm:col-span-4">
                <code className="text-sm text-black/60">{k}</code> {t(LABEL[k] ?? k)}
              </span>
              <span className="text-black/70 sm:col-span-6">{s.summary}</span>
              <span className="text-sm tabular-nums text-muted-foreground sm:col-span-2 sm:text-right">
                {s.ms != null ? `${s.ms} ms` : ""} · {k === "analyze" ? t("computed from tool results") : byModel.includes(k) ? t("model called") : t("auto-completed")}
              </span>
              <span className="text-sm text-black/50 sm:col-span-12">{t("Source")}: {t(SOURCE[k] ?? "")}</span>
            </li>
          );
        })}
      </ol>
      {bullets?.length ? (
        <div className="mt-4 border-l-2 border-navy-700 pl-4">
          <p className="text-sm text-black/50">{t("Agent summary")}</p>
          <ul className="mt-1 list-none space-y-2 text-sm text-black">
            {bullets.map((b) => (
              <li key={b.text}>
                {bulletText(b.text)}{" "}
                {b.sourceUrl && <a href={b.sourceUrl} target="_blank" rel="noreferrer">{t(SOURCE_LINK[b.kind])} ↗</a>}
                {b.kind === "measure" && b.whatChangesSourceUrl && b.whatChangesSourceUrl !== b.sourceUrl && (
                  <> · <a href={b.whatChangesSourceUrl} target="_blank" rel="noreferrer">{t("What it changes")} ↗</a></>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : narration ? (
        <div className="mt-4 border-l-2 border-navy-700 pl-4">
          <p className="text-sm text-black/50">{t("Agent summary")}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-black">{narration}</p>
        </div>
      ) : null}
    </details>
  );
}
