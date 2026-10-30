"use client";
// Towny self-check step (Design spec via steering, Oct 30 1:22 PM CT). Second-to-last step of the agent timeline.
// Takes { report, claims } from lib/towny/verify.ts (verifyClaims / verifyBallotRun). Standalone: AgentTimeline can drop it in.
// Rules: tokens only, 14px minimum, radius 0, tap targets >= 44px, ink or primary only (no red, amber or green).
import { useRef, useState } from "react";
import { Check, CircleDashed, CircleHelp } from "lucide-react";
import type { VerifiedClaim, VerifyReport, Status } from "../lib/towny/verify";

export const UNSURE_EXPLAINER = "Unsure items are marked below. Towny won't present them as fact.";
type Group = "confirmed" | "unsure" | "no_record";
const groupOf = (s: Status): Group | null => (s === "confirmed" || s === "differs" ? "confirmed" : s === "unsure" ? "unsure" : s === "no_record" ? "no_record" : null);

export function verifyTitle(n: number) {
  return `Checked ${n} ${n === 1 ? "claim" : "claims"} against sources`;
}
export function verifyFinding(r: Pick<VerifyReport, "confirmed" | "unsure" | "noRecord">) {
  return `${r.confirmed} confirmed · ${r.unsure} unsure · ${r.noRecord} no record`;
}

export default function VerifyStep({ report, claims, idPrefix = "verify" }: { report: VerifyReport; claims: VerifiedClaim[]; idPrefix?: string }) {
  const [flash, setFlash] = useState<Group | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rows = claims.filter((c) => groupOf(c.status));

  const jump = (g: Group) => {
    const first = rows.find((c) => groupOf(c.status) === g);
    if (!first) return;
    document.getElementById(`${idPrefix}-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(g);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 400);
  };
  const count = (g: Group, n: number, label: string) => (
    <button type="button" onClick={() => jump(g)} disabled={n === 0} aria-label={`${n} ${label}: show these rows`}
      className="min-h-[44px] rounded-none px-1 text-base text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:no-underline">
      {n} {label}
    </button>
  );

  return (
    <section aria-label="Self-check" className="rounded-none border border-border bg-background p-4 text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">{verifyTitle(report.checked)}</h3>
        <span className="rounded-none border border-ink px-2 py-0.5 text-sm font-medium">Self-check</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-base tabular-nums" data-testid="verify-finding">
        {count("confirmed", report.confirmed, "confirmed")}<span aria-hidden>·</span>
        {count("unsure", report.unsure, "unsure")}<span aria-hidden>·</span>
        {count("no_record", report.noRecord, "no record")}
      </p>
      {report.unsure > 0 && <p className="mt-1 text-base text-ink">{UNSURE_EXPLAINER}</p>}
      {report.fallbacks.map((f) => <p key={f} className="mt-1 text-sm text-ink">{f.endsWith(".") ? f : `${f}.`}</p>)}

      <ul className="mt-3 divide-y divide-border">
        {rows.map((c) => {
          const g = groupOf(c.status)!;
          return (
            <li key={c.id} id={`${idPrefix}-${c.id}`} data-status={c.status}
              className={`flex min-h-[44px] items-start gap-2 py-2 text-base transition-opacity duration-300 motion-reduce:transition-none ${flash === g ? "opacity-40" : "opacity-100"}`}>
              {g === "confirmed" && <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
              {g === "unsure" && <CircleHelp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink" />}
              {g === "no_record" && <CircleDashed aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                {g === "unsure" ? (
                  <>
                    <span className="underline decoration-1 decoration-dashed underline-offset-4">{c.display}</span>{" "}
                    <span className="ml-1 inline-block rounded-none border border-ink px-2 text-sm font-medium">Unsure</span>
                    {c.note && <p className="mt-1 text-sm text-ink">{c.note}</p>}
                  </>
                ) : g === "no_record" ? (
                  <>
                    <span className="text-ink">{c.display}</span>
                    {c.note && <span className="ml-1 text-sm text-ink">{c.note}</span>}
                  </>
                ) : (
                  <>
                    <span>{c.display}</span>
                    {c.note && <p className="mt-1 text-sm text-ink">{c.note}</p>}
                    {c.source && (
                      <a href={c.source.url} target="_blank" rel="noreferrer"
                        className="ml-1 inline-flex min-h-[44px] items-center rounded-none px-1 text-sm text-primary underline underline-offset-4">
                        {c.source.label}
                      </a>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
