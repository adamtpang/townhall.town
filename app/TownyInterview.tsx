"use client";
import { useRef, useState } from "react";
import { WHO_CHIP } from "../lib/townyChat";
import { useT } from "../lib/i18n";

export type Fill = { issue: string; choice: "yes" | "neutral" | "no"; words: string };
type Step = { tool: string; label: string; status: "running" | "done"; ms?: number; source?: { label: string; url: string } | null };
type Msg = { from: "towny" | "you"; text: string; links?: { label: string; url: string }[]; chips?: string[]; steps?: Step[] };
const LABEL = { yes: "Yes", neutral: "Neutral", no: "No" } as const;

/** Chat interview: Towny asks one open question, turns the reply into Yes/Neutral/No answers,
 *  and the voter checks them in the buttons below. Buttons stay the fallback. Nothing is stored on a server. */
export default function TownyInterview({ zip, city, issues, onFill, answered = 0, carried = 0, savedZip = null, onReset }: { zip: string; city: string; issues: { id: string; label: string }[]; onFill: (f: Fill[]) => void; answered?: number; carried?: number; savedZip?: string | null; onReset?: () => void }) {
  const tc = useT();
  const [open, setOpen] = useState(false);
  const ask = `What do you care about in ${city}? Say it in your own words, like “rents are too high” or “I'm unsure about the tax.”`;
  // Answers are saved once per browser and carry across ZIPs, so say so instead of starting over silently.
  const opener = (n: number) => n > 0
    ? `You've already answered ${n} of ${issues.length}, saved in this browser. Want to add more? Say it in your own words, like “rents are too high” or “I'm unsure about the tax.”`
    : ask;
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "towny", text: ask }]);
  const [said, setSaid] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filled, setFilled] = useState<Record<string, true>>({});
  const [live, setLive] = useState<Step[]>([]);

  // QA judge-path P2 (Oct 30, 1:25 PM CT): a message sent while a reply is pending is queued and answered in order.
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const saidRef = useRef<string[]>([]);
  const filledRef = useRef<Record<string, true>>({});
  function send(raw: string = text) {
    const t = raw.trim();
    if (!t) return;
    setText("");
    setMsgs((m) => [...m, { from: "you", text: t }]);
    queue.current.push(t);
    void drain();
  }
  async function drain() {
    if (running.current) return;
    running.current = true; setBusy(true);
    while (queue.current.length) await turn(queue.current.shift()!);
    running.current = false; setBusy(false);
  }
  async function turn(t: string) {
    const all = [...saidRef.current, t];
    saidRef.current = all; setSaid(all);
    let reply: string;
    let links: { label: string; url: string }[] = [];
    let chips: string[] | undefined;
    let steps: Step[] = [];
    try {
      // Towny agent (lib/towny/agent.ts): each real tool call streams as a step, then one result line.
      const r = await fetch("/api/interview", { method: "POST", headers: { "content-type": "application/json", accept: "application/x-ndjson" }, body: JSON.stringify({ zip, messages: all.map((x) => ({ text: x })) }) });
      let j: any = {};
      if ((r.headers.get("content-type") ?? "").includes("ndjson") && r.body) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        setLive([]);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i); buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            const e = JSON.parse(line);
            if (e.type === "step") setLive((x) => [...x.filter((y) => y.tool !== e.tool), e]);
            else if (e.type === "result") j = e;
          }
        }
        setLive([]);
      } else j = await r.json();
      if (Array.isArray(j.steps)) steps = j.steps;
      const fills = (Array.isArray(j.answers) ? j.answers : []) as Fill[];
      if (fills.length) {
        const fresh = fills.filter((f) => !filledRef.current[f.issue]);
        const nextFilled = { ...filledRef.current }; for (const f of fills) nextFilled[f.issue] = true;
        filledRef.current = nextFilled; setFilled(nextFilled);
        onFill(fills);
        const left = issues.filter((i) => !nextFilled[i.id]);
        const lines = fresh.map((f) => `${issues.find((i) => i.id === f.issue)?.label}: ${LABEL[f.choice]}`);
        reply = (lines.length ? `I filled in ${lines.join("; ")}. Check them below and change any that are wrong.` : "Those are already filled in. Change any of them below.")
          + (left.length ? ` Anything on ${left.slice(0, 3).map((i) => i.label.toLowerCase()).join(", ")}?` : " That covers every question.");
      } else {
        // QA judge-path P1-1/P1-2: the server always answers from curated data (lib/towny/answer.ts) when nothing fills.
        reply = typeof j.reply === "string" ? j.reply : "I can help with what's on your ballot, who is running for an office, when and where to vote, and how Towny works.";
        if (Array.isArray(j.links)) links = j.links.filter((l: { url?: unknown }) => typeof l?.url === "string" && /^https:\/\//.test(l.url as string));
        if (Array.isArray(j.chips) && j.chips.length) chips = j.chips.filter((c: unknown) => typeof c === "string");
      }
    } catch {
      reply = "I couldn't reach Towny just now. Try again in a moment.";
    }
    // A source already shown on its step is not repeated in the links row.
    links = links.filter((l) => !steps.some((s) => s.source?.url === l.url));
    setMsgs((m) => [...m, { from: "towny", text: reply, links, chips, steps }]);
  }
  function chip(c: string) {
    if (c === WHO_CHIP) { document.querySelector("#what-matters [data-issue-intro]")?.scrollIntoView({ block: "start" }); return; }
    send(c);
  }

  // QA P2 (4c21a5c): the carry-over is also said on the page, not only inside the chat.
  // QA P2 (9dfe90d): normal body text, and it says when the answers came from another ZIP.
  // Design p9: only answers that were saved before this page load (carried), never ones given in this session.
  const carry = carried > 0
    // QA 10:48 AM CT Oct 30 (P1): answers are issue preferences, not tied to a place, so they carry over without naming a ZIP.
    ? <p className="mb-3 flex flex-wrap items-center gap-x-3 text-base leading-6 text-black" data-carryover>{tc(carryText(carried, zip, savedZip, answered))}
        {onReset ? <button type="button" onClick={onReset} className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-2" data-carry-reset>{tc("Reset")}</button> : null}</p>
    : null;
  if (!open) return (
    <div className="mt-6" data-interview>
      {carry}
      <button type="button" onClick={() => { setMsgs([{ from: "towny", text: opener(answered) }]); setOpen(true); }} data-interview-start
        className="inline-flex h-12 items-center border border-black px-5 text-base font-[530] text-black [@media(hover:hover)]:hover:bg-brand-50">
        Or tell Towny in your own words
      </button>
    </div>
  );
  return (
    <div className="mt-6 max-w-2xl border border-black/15 p-4 md:p-6" data-interview>
      {carry}
      <ol className="space-y-3" aria-live="polite">
        {msgs.map((m, i) => (
          <li key={i} className={m.from === "you" ? "ml-auto max-w-[85%] bg-black px-4 py-3 text-base leading-6 text-[#F2F2F2] w-fit" : "max-w-[85%] whitespace-pre-line bg-black/[0.04] px-4 py-3 text-base leading-6 text-black w-fit"} data-msg={m.from}>
            {m.text}
            {m.steps?.length ? (
              <ol className="mt-2 space-y-1 border-l-2 border-brand-700 pl-3 text-sm text-black/60" data-towny-steps>
                {m.steps.map((s) => (
                  <li key={s.tool}>{s.label}{s.ms != null ? ` · ${s.ms} ms` : ""}{s.source ? <> · <a href={s.source.url} target="_blank" rel="noreferrer" className="th-link">{s.source.label} ↗</a></> : null}</li>
                ))}
              </ol>
            ) : null}
            {m.links?.length ? (
              <span className="mt-1 flex flex-wrap gap-x-4" data-towny-links>
                {m.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm th-link underline-offset-2 hover:underline" data-towny-source>{l.label} ↗</a>
                ))}
              </span>
            ) : null}
            {m.chips?.length ? (
              <span className="mt-3 flex flex-wrap gap-2" data-towny-chips>
                {m.chips.map((c) => <button key={c} type="button" onClick={() => chip(c)} className="min-h-11 border border-black/30 bg-transparent px-4 py-2 text-left text-base text-black" data-towny-chip>{c}</button>)}
              </span>
            ) : null}
          </li>
        ))}
        {busy ? (
          <li className="text-sm text-black/60" data-towny-live>
            {live.length ? live.map((s) => <span key={s.tool} className="block">{s.label}{s.status === "done" ? ` · ${s.ms} ms` : "…"}</span>) : "Reading what you wrote…"}
          </li>
        ) : null}
      </ol>
      {said.length < 12 ? (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="towny-say" className="sr-only">Your answer</label>
          <input id="towny-say" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} autoComplete="off" data-interview-input
            className="h-12 min-w-0 flex-1 border border-black/45 bg-transparent px-3 text-base text-black focus:border-brand-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" placeholder="Type here" />
          <button type="submit" disabled={!text.trim()} data-interview-send className="h-12 bg-black px-5 text-base font-[530] text-[#F2F2F2] disabled:opacity-40">Send</button>
        </form>
      ) : null}
      <p className="mt-3 text-sm text-black/60">What you type goes to an AI model to fill the answers or answer your question. It isn&apos;t saved. Please leave out names and addresses.</p>
    </div>
  );
}

/** The carry-over notice. QA 10:48 AM CT Oct 30: plain wording, no ZIP; Reset sits right after it. */
export function carryText(n: number, zip: string, savedZip: string | null, total = n): string {
  void n; void zip; void savedZip; void total;
  return "Using your saved answers.";
}
