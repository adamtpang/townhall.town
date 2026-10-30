"use client";
import { useRef, useState } from "react";

type Step = { name: string; url: string; label: string; status: "running" | "done" | "failed"; detail?: string };
type Cite = { name: string; quote: string; url: string };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** Towny reads each candidate's own listed pages, on screen, and shows only verbatim quotes with the link they came from. */
export default function TownyResearch({ zip, raceId, title, names, issues }: { zip: string; raceId: string; title: string; names: string[]; issues: string[] }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [cites, setCites] = useState<Cite[]>([]);
  const [none, setNone] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const busy = useRef(false);
  async function run() {
    if (busy.current) return; busy.current = true;
    setState("running"); setSteps([]); setCites([]); setNone({}); setErr("");
    try {
      const res = await fetch(`/api/research?zip=${zip}&race=${encodeURIComponent(raceId)}&issues=${issues.join(",")}`);
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.message || `Research failed (${res.status})`); }
      const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line) continue;
          const e = JSON.parse(line);
          if (e.type === "step") setSteps((s) => { const k = s.findIndex((x) => x.url === e.url && x.name === e.name); return k >= 0 ? s.map((x, j) => (j === k ? e : x)) : [...s, e]; });
          else if (e.type === "citation") setCites((c) => [...c, e]);
          else if (e.type === "none") setNone((n) => ({ ...n, [e.name]: e.message }));
          else if (e.type === "error") throw new Error(e.message);
        }
      }
      setState("done");
    } catch (e: any) { setErr(String(e?.message || e)); setState("error"); }
    busy.current = false;
  }
  return (
    <div className="mt-2" data-towny-research={raceId}>
      {state === "idle" ? (
        <button type="button" onClick={run} className="inline-flex min-h-11 items-center border border-black/30 px-4 text-sm text-black hover:border-black" data-research-start>
          Have Towny read the candidates&rsquo; own pages
        </button>
      ) : (
        <div className="border-l border-black/15 pl-4" aria-live="polite">
          <p className="text-xs leading-4 text-black/60">Towny reads each candidate&rsquo;s listed pages and quotes them word for word, with the link. Quotes are not checked by a person and are not counted in overlap.</p>
          {names.map((n) => {
            const st = steps.filter((s) => s.name === n), cs = cites.filter((c) => c.name === n);
            if (!st.length && !none[n]) return null;
            return (
              <div key={n} className="mt-3" data-research-cand={n}>
                <p className="text-sm font-[530]">{n}</p>
                <ul className="mt-1 space-y-0.5">
                  {st.map((s) => <li key={s.url} className="text-xs leading-4 text-black/60" data-research-step={s.status}>{s.status === "running" ? "…" : s.status === "done" ? "✓" : "×"} {s.label}{s.detail ? `: ${s.detail}` : ""}</li>)}
                </ul>
                {cs.length > 0 && <ul className="mt-2 space-y-2">{cs.map((c, i) => (
                  <li key={i} className="text-sm text-black/80" data-research-cite>&ldquo;{c.quote}&rdquo; <a href={c.url} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-3 after:content-[''] whitespace-nowrap text-[#3760F2]">{host(c.url)} ↗</a></li>
                ))}</ul>}
                {none[n] && <p className="mt-1 text-sm text-black/60" data-research-none>{none[n]}.</p>}
              </div>
            );
          })}
          {state === "running" && <p className="mt-3 text-xs leading-4 text-black/60">Reading pages for {title}…</p>}
          {state === "error" && <p className="mt-3 text-sm text-black/60" data-research-error>{err} <button type="button" onClick={run} className="inline-flex min-h-11 items-center underline">Try again</button></p>}
        </div>
      )}
    </div>
  );
}
