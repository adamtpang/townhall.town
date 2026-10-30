"use client";
// Floating Towny button + chat panel (Adam 1:13 PM CT Oct 30). Reuses Towny's existing pieces: /api/interview (which
// answers "What's on my ballot?" from shipped data via lib/townyFacts and turns free text into issue answers), the issue
// answer format in localStorage (th-answers-v1), and fixed code replies for who-to-vote-for and out-of-scope places.
// No new model pipeline. Nothing is stored on a server; answers stay in this browser.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { TownyMark } from "./TownyMark";
import { Button } from "../ui/button";
import {
  TOWNY_LABEL, TOWNY_OPENER, TOWNY_CAPTION, TOWNY_SUGGESTIONS, WHO_TO_VOTE_REPLY, WHO_CHIP, OUT_OF_SCOPE, ASK_ZIP, THINKING,
  PLACEHOLDER, NO_MATCH, FAILED, routeTurn, sameCity, STATE_OF, linkText, dedupeByHost,
} from "../../lib/townyChat";
import { FAQS, faqFor } from "../../lib/towny/faq";
import { issuesFor } from "../../lib/issueOrder";
import { press, normalizeAnswers } from "../../lib/overlapCore.mjs";
import { CITY } from "../../lib/gcal";
import { COVERED_ZIPS } from "../../lib/site";

type Link = { label: string; url: string };
type Msg = { from: "towny" | "you"; text: string; links?: Link[]; chips?: string[] };
const ANSWERS_KEY = "th-answers-v1";
const ANSWERS_ZIP_KEY = "th-answers-zip-v1";
const LABEL = { yes: "Yes", neutral: "Neutral", no: "No" } as const;
const FAQ_CHIPS = FAQS.map((f) => f.q);

function pageZip(): string | null {
  if (typeof document === "undefined") return null;
  // The ZIP typed on the page (BallotAgent's postal-code input), else the ZIP the saved answers belong to.
  const z = document.querySelector<HTMLInputElement>('input[autocomplete="postal-code"]')?.value?.trim();
  if (z && COVERED_ZIPS.includes(z)) return z;
  try { const s = localStorage.getItem(ANSWERS_ZIP_KEY); return s && COVERED_ZIPS.includes(s) ? s : null; } catch { return null; }
}

/** `zip`: the page's own ZIP when it has no ZIP box (e.g. /card?zip=, the ballot results page). */
export default function TownyFab({ zip: pageOwnZip }: { zip?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "towny", text: TOWNY_OPENER, chips: [...TOWNY_SUGGESTIONS] }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState<string | null>(null);
  const [zipFocused, setZipFocused] = useState(false);
  const [lifted, setLifted] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // Phones: hide the button while the ZIP input is focused (keyboard up).
  useEffect(() => {
    const isZip = (t: EventTarget | null) => t instanceof HTMLInputElement && t.autocomplete === "postal-code";
    const fin = (e: FocusEvent) => { if (isZip(e.target)) setZipFocused(true); };
    const fout = (e: FocusEvent) => { if (isZip(e.target)) setZipFocused(false); };
    document.addEventListener("focusin", fin); document.addEventListener("focusout", fout);
    return () => { document.removeEventListener("focusin", fin); document.removeEventListener("focusout", fout); };
  }, []);
  // While a "Jump to results" bar ([data-jump-results]) is on screen, the button sits 64px higher.
  useEffect(() => {
    const check = () => {
      const el = document.querySelector<HTMLElement>("[data-jump-results]");
      if (!el) return setLifted(false);
      const r = el.getBoundingClientRect();
      setLifted(r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(el).visibility !== "hidden");
    };
    check();
    const id = window.setInterval(check, 500);
    window.addEventListener("scroll", check, { passive: true }); window.addEventListener("resize", check);
    return () => { window.clearInterval(id); window.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, []);

  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => fab.current?.focus()); }, []);
  useEffect(() => { if (open) { setZip((z) => z ?? (pageOwnZip && COVERED_ZIPS.includes(pageOwnZip) ? pageOwnZip : pageZip())); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  // Design, Oct 30 1:38 PM CT: while the phone sheet is open the page behind it does not scroll. Desktop (lg) keeps the page live.
  useEffect(() => {
    if (!open || window.matchMedia("(min-width: 1024px)").matches) return;
    const b = document.body.style; const prev = b.overflow;
    b.overflow = "hidden"; document.body.dataset.townyLock = "1";
    return () => { b.overflow = prev; delete document.body.dataset.townyLock; };
  }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  // Focus trap + Esc.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab" || !panel.current) return;
    const f = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // QA pre-pass 1ee5f9c P2-2: each reply renders once. The message log itself is the polite live region (role=log), so
  // there is no second, duplicate copy of the text for screen readers.
  // QA pre-pass 6b2ae5c P2: one source link per hostname, whatever path the reply came from.
  const say = (m: Omit<Msg, "from">) => { setMsgs((x) => [...x, { from: "towny", ...m, links: m.links ? dedupeByHost(m.links) : undefined }]); };

  function applyFills(z: string, fills: { issue: string; choice: "yes" | "neutral" | "no" }[]) {
    const issues = issuesFor(z, STATE_OF[z]);
    let a: Record<string, unknown> = {};
    try { a = normalizeAnswers(JSON.parse(localStorage.getItem(ANSWERS_KEY) || "{}") || {}) as Record<string, unknown>; } catch { /* ignore */ }
    const lines: string[] = [];
    for (const f of fills) {
      const i = issues.find((x) => x.id === f.issue); if (!i) continue;
      a[f.issue] = (press({}, f.issue, f.choice, i.yesMeansPole) as Record<string, unknown>)[f.issue];
      lines.push(`${i.label}: ${LABEL[f.choice]}`);
    }
    try { localStorage.setItem(ANSWERS_KEY, JSON.stringify(a)); localStorage.setItem(ANSWERS_ZIP_KEY, z); } catch { /* ignore */ }
    window.dispatchEvent(new Event("townhall:answers"));
    return lines;
  }

  // QA judge-path P2: a message sent while a reply is pending is queued, then answered in order.
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const zipRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  useEffect(() => { zipRef.current = zip; }, [zip]);
  function send(raw: string) {
    const t = raw.trim();
    if (!t) return;
    setText(""); if (input.current) input.current.style.height = "";
    setMsgs((x) => [...x, { from: "you", text: t }]);
    queue.current.push(t);
    void drain();
  }
  async function drain() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length) await turn(queue.current.shift()!);
    running.current = false;
  }
  async function turn(t: string) {
    const zip = zipRef.current; const pending = pendingRef.current;
    const setZip2 = (z: string | null) => { zipRef.current = z; setZip(z); };
    const setPending = (p: string | null) => { pendingRef.current = p; };
    const r = routeTurn(t, zip);
    const z = r.kind === "fixed" ? r.zip ?? zip : r.zip;
    if (r.kind !== "fixed" || r.zip) setZip2(z ?? null);
    if (r.kind === "fixed" && (r.reply === OUT_OF_SCOPE || r.reply === WHO_TO_VOTE_REPLY)) return say({ text: r.reply, chips: r.chips, links: r.links });
    // Another part of a covered city goes to the server for the same-city line, never the covered ZIP's FAQ answer.
    const faq = sameCity(t) ? null : faqFor(t, z ?? null);
    if (faq) return say({ text: faq.a, links: faq.links, chips: faq.id === "who" ? [WHO_CHIP] : undefined });
    if (r.kind === "fixed") {
      if (r.reply === ASK_ZIP) { setPending(t); return say({ text: ASK_ZIP }); }
      // A bare covered ZIP: answer the question that was waiting for it, if any.
      if (pending && r.zip) { const p = pending; setPending(null); return ask(p, r.zip); }
      return say({ text: r.reply });
    }
    if (r.kind === "think") {
      if (!r.zip) { setPending(t); return say({ text: ASK_ZIP }); }
      return say({ text: `What do you care about in ${CITY[r.zip] || "your area"}? Say it in your own words, like “rents are too high” or “I'm unsure about the tax.”` });
    }
    return ask(t, r.zip);
  }

  async function ask(t: string, z: string) {
    if (/^help me think through an issue\b/i.test(t)) return say({ text: `What do you care about in ${CITY[z] || "your area"}? Say it in your own words, like “rents are too high” or “I'm unsure about the tax.”` });
    setBusy(true);
    try {
      const res = await fetch("/api/interview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zip: z, messages: [{ text: t }] }) });
      const j = await res.json();
      if (!res.ok && !j.answers?.length && typeof j.reply !== "string") throw new Error("failed");
      const links: Link[] = Array.isArray(j.links) ? j.links.filter((l: Link) => typeof l?.url === "string" && /^https:\/\//.test(l.url)) : [];
      const chips: string[] | undefined = Array.isArray(j.chips) && j.chips.length ? j.chips.filter((c: unknown) => typeof c === "string") : undefined;
      if (j.answers?.length) {
        const lines = applyFills(z, j.answers);
        say({ text: lines.length ? `I filled in ${lines.join("; ")}. Check them in Who lines up with you and change any that are wrong.` : NO_MATCH, chips: lines.length ? undefined : FAQ_CHIPS });
      } else if (typeof j.reply === "string") say({ text: j.reply, links, chips });
      else say({ text: NO_MATCH, chips: FAQ_CHIPS });
    } catch { say({ text: FAILED }); }
    setBusy(false);
  }

  // Adam, Oct 30 2:08 PM CT: on /card the overlap chip goes to the card's own "Who lines up with you" race list
  // ([data-card-overlap]). A page with its own ZIP never says "Enter your ZIP on the page first"; with no overlap
  // section to go to, the chip is hidden there instead.
  const whoTarget = () => (typeof document === "undefined" ? null : document.getElementById("what-matters") ?? document.querySelector<HTMLElement>("[data-card-overlap]"));
  const showChip = (c: string) => c !== WHO_CHIP || !pageOwnZip || !!whoTarget();
  function chip(c: string) {
    if (c === WHO_CHIP) {
      const el = whoTarget();
      if (el) { setOpen(false); el.scrollIntoView({ block: "start" }); (el.querySelector<HTMLElement>("h2") ?? el).focus?.(); return; }
      if (pageOwnZip) return;
      return say({ text: "Enter your ZIP on the page first. Then answer the questions in Who lines up with you to see the overlap." });
    }
    send(c);
  }

  const autosize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 116)}px`; };
  const pos = lifted
    ? "bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-[calc(88px+env(safe-area-inset-bottom))]"
    : "bottom-[calc(16px+env(safe-area-inset-bottom))] lg:bottom-[calc(24px+env(safe-area-inset-bottom))]";

  return (
    <>
      <button ref={fab} type="button" aria-label={TOWNY_LABEL} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} data-towny-fab
        style={{ ["--k" as string]: "hsl(var(--primary))", ["--towny-face" as string]: "hsl(var(--primary))" }}
        className={`fixed right-4 z-40 flex print:hidden h-14 w-14 items-center justify-center rounded-none bg-primary text-primary-foreground lg:right-6 ${pos} ${zipFocused ? "max-lg:hidden" : ""} ${open ? "max-lg:hidden" : ""}`}>
        <TownyMark size={36} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 lg:hidden print:hidden" aria-hidden onClick={close} data-towny-overlay />
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Towny chat" onKeyDown={onKeyDown} data-towny-panel
            style={{ ["--k" as string]: "hsl(var(--background))" }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] print:hidden flex-col rounded-none border-t border-border bg-background text-foreground lg:inset-x-auto lg:bottom-6 lg:right-6 lg:h-[640px] lg:max-h-[calc(100dvh-48px)] lg:w-[400px] lg:border lg:shadow-lg">
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border pl-4 pr-1">
              <TownyMark size={40} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-[530] leading-6">Towny</p>
                <p className="truncate text-sm leading-5 text-muted-foreground" data-towny-caption>{TOWNY_CAPTION}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close Towny" className="flex h-11 w-11 shrink-0 items-center justify-center" data-towny-close><X size={20} aria-hidden /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-towny-scroll>
              <ol className="space-y-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="Towny conversation" data-towny-log data-towny-live>
                {msgs.map((m, i) => (
                  <li key={i} data-msg={m.from} className={m.from === "you" ? "ml-auto w-fit max-w-[85%] bg-muted px-4 py-3 text-base leading-6" : "text-base leading-6"}>
                    {m.text}
                    {m.links?.length ? (
                      <span className="mt-1 flex flex-wrap gap-x-4" data-towny-links>
                        {m.links.map((l, _, all) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" title={l.label} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4" data-towny-source>{linkText(l, all)} ↗<span className="sr-only"> (opens in a new tab)</span></a>)}
                      </span>
                    ) : null}
                    {m.chips?.filter(showChip).length ? (
                      <span className="mt-3 flex flex-wrap gap-2" data-towny-chips>
                        {m.chips.filter(showChip).map((c) => <Button key={c} type="button" variant="outline" onClick={() => chip(c)} className="h-auto min-h-11 whitespace-normal rounded-none border-input py-2 text-left text-base font-[450]" data-towny-chip>{c}</Button>)}
                      </span>
                    ) : null}
                  </li>
                ))}
                {busy ? <li className="text-base leading-6 text-muted-foreground motion-safe:animate-pulse" data-towny-thinking>{THINKING}</li> : null}
              </ol>
              <div ref={end} />
            </div>
            <form className="flex shrink-0 items-end gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <label htmlFor="towny-fab-say" className="sr-only">{PLACEHOLDER}</label>
              <textarea id="towny-fab-say" ref={input} rows={1} value={text} maxLength={600} placeholder={PLACEHOLDER} autoComplete="off" data-towny-input
                onChange={(e) => { setText(e.target.value); autosize(e.target); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }}
                className="max-h-[116px] min-h-11 min-w-0 flex-1 resize-none rounded-none border border-input bg-transparent px-3 py-2.5 text-base leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none" />
              <Button type="submit" aria-label="Send" disabled={!text.trim()} className="h-11 w-11 shrink-0 rounded-none bg-primary p-0 text-primary-foreground hover:bg-primary/90" data-towny-send><ArrowUp size={20} aria-hidden /></Button>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}
