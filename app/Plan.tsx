"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { bring, fmtDate, ics, lookups, planDates } from "../lib/plan";

type RaceLite = { id: string; title: string; candidates: { name: string; party?: string | null }[] };
type MeasureLite = { id: string; title: string };
type Picks = Record<string, string>;
const KEY = "townhall.picks.v1";
const UNDECIDED = "Undecided";
const SITE = "https://townhall.town";

function load(zip: string): Picks {
  try { return (JSON.parse(localStorage.getItem(KEY) || "{}") || {})[zip] || {}; } catch { return {}; }
}
function save(zip: string, p: Picks) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; all[zip] = p; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="relative after:absolute after:-inset-x-3 after:-inset-y-4 after:content-[''] text-sm">{children} ↗</a>
);

export default function Plan({ zip, state, place, electionDate, races, measures }: { zip: string; state: "TX" | "CA" | "NY"; place: string; electionDate: string; races: RaceLite[]; measures: MeasureLite[] }) {
  const [picks, setPicks] = useState<Picks>({});
  const [addr, setAddr] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setPicks(load(zip)); setMounted(true); }, [zip]);
  // Past dates drop off (compared in Central Time), so the Oct 30 early-voting row hides after Oct 30.
  const todayCT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const dates = planDates(state, electionDate).filter((d) => d.date >= todayCT);
  const look = lookups(state);
  const id = bring(state);
  const rows = useMemo(
    () => [
      ...races.filter((r) => r.candidates.length).map((r) => ({ id: r.id, title: r.title, options: r.candidates.map((c) => ({ v: c.name, sub: c.party || undefined })) })),
      ...measures.map((m) => ({ id: m.id, title: m.title, options: [{ v: "Yes" }, { v: "No" }] as { v: string; sub?: string }[] })),
    ],
    [races, measures]
  );
  const decided = rows.filter((r) => picks[r.id] && picks[r.id] !== UNDECIDED).length;

  function pick(raceId: string, v: string) {
    const next = { ...picks, [raceId]: v };
    setPicks(next);
    save(zip, next);
  }
  function shareText() {
    const lines = rows.filter((r) => picks[r.id] && picks[r.id] !== UNDECIDED).map((r) => `${r.title}: ${picks[r.id]}`);
    return [`My ballot plan, ${fmtDate(electionDate)}, 2026`, ...(lines.length ? lines : ["No choices yet"]), SITE].join("\n");
  }
  async function share() {
    const text = shareText();
    setShared(null);
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "My ballot plan", text }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    setShared("Opening Messages…");
  }

  return (
    <>
      <dl className="mt-16">
        {dates.map((d) => (
          <div key={d.id} className="grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12">
            <dt className="font-serif text-5xl leading-none sm:col-span-4">{fmtDate(d.date).replace(/^\w+, /, "")}</dt>
            <dd className="sm:col-span-8">
              <p className="text-xl">{d.label}</p>
              {d.note && <p className="mt-1 text-sm text-black/60">{d.note}</p>}
              <div className="flex flex-wrap items-center gap-x-6">
                <button type="button" onClick={() => download(`${d.id}.ics`, ics(d, place))} className="inline-flex min-h-11 items-center text-sm text-[#3760f2] underline decoration-black/20 underline-offset-2 hover:decoration-[#3760f2]">Add to calendar</button>
                <Ext href={d.source.url}>{d.source.label}</Ext>
              </div>
            </dd>
          </div>
        ))}
        <div className="grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12">
          <dt className="font-serif text-5xl leading-none sm:col-span-4">Where</dt>
          <dd className="sm:col-span-8">
            <p className="text-xl">Your county sets locations</p>
            <div className="flex flex-wrap gap-x-6">{look.map((l) => <Ext key={l.url} href={l.url}>{l.label}</Ext>)}</div>
            <label className="mt-4 block text-sm text-black/60" htmlFor="poll-addr">Polling place address, from the lookup above</label>
            <div className="flex flex-wrap items-end gap-x-6">
              <Input id="poll-addr" autoComplete="off" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Street, city" className="max-w-md flex-1" />
              {addr.trim().length > 4 && (
                <Ext href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr.trim())}`}>Directions in Google Maps</Ext>
              )}
            </div>
            <p className="mt-2 text-xs text-black/50">Not saved. It only builds the map link.</p>
          </dd>
        </div>
        <div className="grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12">
          <dt className="font-serif text-5xl leading-none sm:col-span-4">Bring</dt>
          <dd className="sm:col-span-8">
            <p className="text-xl">{id.text}</p>
            <Ext href={id.source.url}>{id.source.label}</Ext>
          </dd>
        </div>
        <div className="grid grid-cols-1 gap-2 border-t border-black/15 py-8 sm:grid-cols-12" id="picks">
          <dt className="sm:col-span-4">
            <span className="font-serif text-5xl leading-none">Your choices</span>
            <p className="mt-3 text-sm text-black/60">{decided} of {rows.length} decided. Saved on this device only.</p>
          </dt>
          <dd className="sm:col-span-8">
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => window.print()}>Print</Button>
              <Button type="button" variant="outline" onClick={share}>Share my plan</Button>
            </div>
            {shared && <p className="mt-2 text-sm text-black/60">{shared}</p>}
            <div className="mt-6">
              {rows.map((r) => (
                <fieldset key={r.id} className="border-t border-black/10 py-4 first:border-t-0" data-pick={r.id}>
                  <legend className="float-left w-full text-base font-medium">{r.title}</legend>
                  <div className="clear-both flex flex-wrap gap-x-6 pt-1">
                    {[...r.options, { v: UNDECIDED }].map((o) => (
                      <label key={o.v} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name={`pick-${r.id}`} value={o.v} checked={(picks[r.id] || UNDECIDED) === o.v} onChange={() => pick(r.id, o.v)} className="h-4 w-4 accent-[#3760f2]" />
                        <span>{o.v}{"sub" in o && o.sub ? <span className="text-black/50"> · {o.sub}</span> : null}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </dd>
        </div>
      </dl>
      {mounted && createPortal(
        <div id="print-sheet" aria-hidden>
          <p className="ps-head">townhall.town · {place} · {dates.map((d) => `${d.label}: ${fmtDate(d.date)}`).join(" · ")}</p>
          <h1>My ballot plan</h1>
          <ol>
            {rows.map((r) => (
              <li key={r.id}><span>{r.title}</span><b>{picks[r.id] || UNDECIDED}</b></li>
            ))}
          </ol>
          <p className="ps-foot">Bring: {id.text}. Find your polling place: {look[0].url}{addr.trim() ? ` · Polling place: ${addr.trim()}` : ""}. Nonpartisan; your choices are yours and stay on your device.</p>
        </div>,
        document.body
      )}
    </>
  );
}
