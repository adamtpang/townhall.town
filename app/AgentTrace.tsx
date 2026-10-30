"use client";
import { useT } from "../lib/i18n";

type Step = { tool: string; status: "running" | "done"; summary?: string; ms?: number };

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
  analyze: "the results above, plus official measure costs",
};

/** The agent's work, shown: every tool call, what it returned, how long it took, and whether the model chose it. */
export default function AgentTrace({
  tools,
  steps,
  byModel,
  model,
  mode,
  narration,
  seconds,
}: {
  tools: string[];
  steps: Record<string, Step>;
  byModel: string[];
  model: string | null;
  mode: "live" | "fallback";
  narration: string;
  seconds: number | null;
}) {
  const t = useT();
  const done = tools.filter((k) => steps[k]?.status === "done");
  if (!done.length) return null;
  return (
    <details open className="mt-6 border-t border-black/15 pt-4" data-agent-trace>
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-black/70">
        <span className="font-[530] text-black">{t("How the agent built this")}</span>
        <span>
          {done.length} {t("tool calls")}
          {seconds != null ? ` · ${seconds.toFixed(1)}s` : ""}
          {mode === "live" && model ? ` · ${model.replace(/ \(AI Gateway\)$/, "")}` : ` · ${t("no model (fallback)")}`}
        </span>
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {done.map((k) => {
          const s = steps[k];
          const chose = k === "analyze" || byModel.includes(k);
          return (
            <li key={k} className="grid grid-cols-1 gap-1 sm:grid-cols-12">
              <span className="text-black sm:col-span-4">
                <code className="text-xs text-black/60">{k}</code> {t(LABEL[k] ?? k)}
              </span>
              <span className="text-black/70 sm:col-span-6">{s.summary}</span>
              <span className="text-xs text-black/50 sm:col-span-2 sm:text-right">
                {s.ms != null ? `${s.ms} ms` : ""} · {k === "analyze" ? t("model reasoning") : chose ? t("model called") : t("auto-completed")}
              </span>
              <span className="text-xs text-black/50 sm:col-span-12 sm:pl-0">{t("Source")}: {t(SOURCE[k] ?? "")}</span>
            </li>
          );
        })}
      </ol>
      {narration && (
        <div className="mt-4 border-l-2 border-[#3760f2] pl-4">
          <p className="text-xs text-black/50">{t("Agent summary")}</p>
          <p className="mt-1 whitespace-pre-line text-base text-black">{narration}</p>
        </div>
      )}
    </details>
  );
}
