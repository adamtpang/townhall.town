"use client";
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";

type Step = { tool: string; status: "running" | "done"; summary?: string; ms?: number; checked?: string; source?: { label: string; url: string } | null };
/** Server-built summary bullet (lib/api/agent.ts SummaryBullet): sourced, two-sided for markets. */
export type SummaryBullet = { kind: "market" | "measure" | "census"; text: string; sourceUrl: string | null; whatChanges?: string | null; whatChangesSourceUrl?: string | null };

const LABEL: Record<string, string> = {
  getDistricts: "Found your districts",
  getRaces: "Listed every race and measure",
  getCandidates: "Looked up the candidates",
  getMarketOdds: "Checked live Polymarket prices",
  getLocalProblems: "Pulled local Census data",
  getCampaignFinance: "Checked campaign finance (live)",
  getCountyUnemployment: "Checked county unemployment (live)",
  analyze: "Analyzed what matters",
};
const SOURCE: Record<string, string> = {
  getDistricts: "Census ZCTA and state district maps",
  getRaces: "Ballotpedia and official election offices",
  getCandidates: "Ballotpedia, FEC, state ethics filings",
  getMarketOdds: "Polymarket live API",
  getLocalProblems: "Census ACS 5-year",
  getCampaignFinance: "OpenFEC API",
  getCountyUnemployment: "BLS LAUS API",
  analyze: "the tool results above, plus official measure costs",
};
const SOURCE_LINK: Record<SummaryBullet["kind"], string> = { market: "Polymarket", measure: "Official cost", census: "Census table" };

// Bullet text arrives as "- ... Source: <url>"; the list supplies the bullet and the link, so strip both from the text.
const bulletText = (s: string) => s.replace(/^\s*-\s*/, "").replace(/\s*Source:\s*\S+\s*$/, "").trim();

// Step rows fade and slide in (180ms). Pure CSS, so no extra JavaScript ships; reduced motion disables it.
const MOTION_CSS = `@keyframes traceIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
[data-agent-trace] [data-step]{animation:traceIn 180ms ease-out both}
@media (prefers-reduced-motion: reduce){[data-agent-trace] [data-step]{animation:none}}`;

/** The agent's work, shown: every tool call, what it returned, how long it took, and whether the model chose it. */
export default function AgentTrace({
  tools,
  steps,
  byModel,
  narration,
  bullets,
  seconds,
  running = false,
  fallback = false,
  model = null,
}: {
  tools: string[];
  steps: Record<string, Step>;
  byModel: string[];
  narration: string;
  bullets?: SummaryBullet[];
  seconds: number | null;
  running?: boolean;
  /** True when no model ran (every step was filled in by code). Shown as a small tag, so the header stays honest. */
  fallback?: boolean;
  /** The model that planned the tool calls; shown only inside the expanded view, as proof. */
  model?: string | null;
}) {
  const t = useT();
  const done = tools.filter((k) => steps[k]?.status === "done");
  // Verbose while the agent runs, collapsed to one line once it finishes; the user can reopen it.
  const [open, setOpen] = useState(running);
  useEffect(() => setOpen(running), [running]);
  const shown = running ? tools.filter((k) => steps[k]) : done;
  if (!shown.length) return null;
  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="mt-6 border border-brand-700 bg-white/70 p-4 backdrop-blur-md" data-agent-trace>
      <style>{MOTION_CSS}</style>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-black/70 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className={`inline-block text-brand-700 transition-transform duration-150 ${open ? "rotate-90" : ""}`}>›</span>
        <span className="font-[530] text-black">{t("How the agent built this")}</span>
        <span className="tabular-nums">
          {running ? ` · ${t("Working")}: ${done.length} ${t("of")} ${tools.length}` : ` · ${done.length} ${t("steps")}`}
          {!running && seconds != null ? ` · ${seconds.toFixed(1)}s` : ""}
          {!running && fallback ? ` · ${t("no model (fallback)")}` : ""}
        </span>
      </summary>
      {!running && (
        <p className="mt-2 text-sm text-black/60">{model ? `${t("Planned by")} ${model} · ${t("called")} ${byModel.length} ${t("of")} ${tools.length - 1} ${t("lookups")}` : t("No model ran; every step was filled in by code.")}</p>
      )}
      <ol className="mt-3 space-y-2 text-sm">
        {shown.map((k, idx) => {
          const s = steps[k];
          return (
            <li key={k} data-step style={{ animationDelay: `${idx * 60}ms` }} className="grid grid-cols-1 gap-1 sm:grid-cols-12">
              <span className="text-black sm:col-span-4">
                <span className="text-sm text-black/60">{k}</span> {t(LABEL[k] ?? k)}
              </span>
              <span className="min-w-0 break-words text-black/70 sm:col-span-6">{s.status === "done" ? s.summary : `${t("Running")}…`}</span>
              <span className="text-sm tabular-nums text-muted-foreground sm:col-span-2 sm:text-right">
                {s.ms != null ? `${s.ms} ms` : ""}
              </span>
              {s.checked ? <span className="text-sm text-black/60 sm:col-span-12">{t("Checked")}: {s.checked}</span> : null}
              <span className="text-sm text-black/60 sm:col-span-12">
                {t("Source")}: {s.source ? <a href={s.source.url} target="_blank" rel="noreferrer">{s.source.label} ↗</a> : t(SOURCE[k] ?? "")}
              </span>
            </li>
          );
        })}
      </ol>
      {bullets?.length ? (
        <div className="mt-4 border-l-2 border-brand-700 pl-4">
          <p className="text-sm text-black/60">{t("Agent summary")}</p>
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
        <div className="mt-4 border-l-2 border-brand-700 pl-4">
          <p className="text-sm text-black/60">{t("Agent summary")}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-black">{narration}</p>
        </div>
      ) : null}
    </details>
  );
}
