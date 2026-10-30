"use client";
import { useState } from "react";
import type { Politician } from "../lib/types";
import { useT } from "../lib/i18n";

export type CandidateFull = Politician & { campaignSite?: string | null; incumbentNote?: string };

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Pac|Usa|Llp|Ut)\b/g, (m) => m.toUpperCase());

function Bar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div>
      <div className="flex justify-between text-sm text-black/70"><span>{label}</span><span className="tabular-nums text-black">{pct(value)}</span></div>
      <div className="mt-1 h-1.5 w-full bg-black/10" role="img" aria-label={`${label}: ${pct(value)}`}>
        <div className="h-full bg-black" style={{ width: pct(value) }} />
      </div>
    </div>
  );
}

function DonorList({ title, rows }: { title: string; rows: { name: string; total: number; kind?: string }[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-black/60">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{titleCase(r.name)}{r.kind ? <span className="text-black/50"> ({r.kind})</span> : null}</span>
            <span className="tabular-nums text-black/70">{usd(r.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Everything sourced we have on one candidate: stated issues (with quotes), FEC money, and links. */
export default function CandidateDetails({ c, id, onClose }: { c: CandidateFull; id: string; onClose: () => void }) {
  const t = useT();
  const [quote, setQuote] = useState<string | null>(null);
  const shown = c.causes?.find((k) => k.id === quote);
  const m = c.money;
  const through = m?.coverageThrough ? new Date(m.coverageThrough + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const links = [
    [t("Campaign site"), c.campaignSite],
    [t("Official site"), c.officialSite],
    ["X", c.x],
    ["Ballotpedia", c.ballotpedia],
  ].filter(([, href]) => href) as [string, string][];

  return (
    <div id={id} className="mt-4 min-w-0 max-w-full border border-black/15 bg-white/70 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-3xl leading-tight">{c.name}</p>
          <p className="mt-1 text-sm text-black/60">
            {c.party || t("Party: unsure")}
            {c.incumbent === true ? ` · ${t("Incumbent")}` : c.incumbent === "unsure" ? ` · ${t("Incumbent: unsure")}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-black/70 underline">{t("Close")}</button>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <h3 className="text-xs uppercase tracking-wide text-black/60">{t("Talks about")}</h3>
          {c.causes?.length ? (
            <>
              <ul className="mt-2 flex flex-wrap gap-2">
                {c.causes.map((k) => (
                  <li key={k.id}>
                    <button type="button" aria-pressed={quote === k.id} onClick={() => setQuote(quote === k.id ? null : k.id)}
                      className={`min-h-9 rounded-full border px-3 text-sm ${quote === k.id ? "border-black bg-black text-white" : "border-black/25 text-black hover:border-black"}`}>
                      {k.label}
                    </button>
                  </li>
                ))}
              </ul>
              {shown ? (
                <blockquote className="mt-3 border-l-2 border-black pl-3 text-sm text-black/80">
                  “{shown.quote}”{" "}
                  <a href={shown.source.url} target="_blank" rel="noreferrer">{t("source")}</a>
                  <span className="block text-xs text-black/50">{shown.mentions} {t(shown.mentions === 1 ? "mention" : "mentions")} · {t("keyword match in their own campaign text")}</span>
                </blockquote>
              ) : (
                <p className="mt-2 text-xs text-black/50">{t("Tap an issue to see their own words.")}</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-black/60">{t("Unsure: no campaign themes on file.")}</p>
          )}
        </section>

        <section className="min-w-0">
          <h3 className="text-xs uppercase tracking-wide text-black/60">{t("Campaign money")}</h3>
          {m ? (
            <>
              <dl className="mt-2 grid grid-cols-3 gap-3">
                {([[t("Raised"), m.raised], [t("Spent"), m.spent], [t("Cash on hand"), m.cashOnHand]] as [string, number][]).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-black/60">{k}</dt>
                    <dd className="font-serif text-2xl tabular-nums">{usd(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 space-y-3">
                <Bar label={t("From small donors (under $200)")} value={m.smallDonorPct} />
                <Bar label={t("From in-state donors (itemized)")} value={m.inStatePct} />
              </div>
              <div className="mt-4 space-y-4">
                <DonorList title={t("Top employers of donors")} rows={m.topEmployers ?? []} />
                <DonorList title={t("Top PACs and committees")} rows={m.topCommittees ?? []} />
              </div>
              <p className="mt-4 text-xs text-black/60">
                {m.lastReport ? `${titleCase(m.lastReport)} ${t("report")}` : t("FEC report")}{through ? `, ${t("through")} ${through}` : ""}.{" "}
                <a href={m.donorsSource?.url ?? m.source.url} target="_blank" rel="noreferrer">FEC</a>. {t("Individual donors are not named.")}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-black/60">
              {t("No FEC data for this race.")}{" "}
              {c.finance?.url && <a href={c.finance.url} target="_blank" rel="noreferrer">{c.finance.label?.includes("Ethics") ? t("Texas Ethics Commission") : t("Finance records")}</a>}
            </p>
          )}
        </section>
      </div>

      {links.length ? (
        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/10 pt-4 text-sm">
          {links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{label} ↗</a>)}
        </p>
      ) : null}
    </div>
  );
}
