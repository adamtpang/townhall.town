"use client";
import { useState } from "react";

export type Fill = { issue: string; choice: "yes" | "neutral" | "no"; words: string };
type Msg = { from: "towny" | "you"; text: string; links?: { label: string; url: string }[] };
const LABEL = { yes: "Yes", neutral: "Neutral", no: "No" } as const;

/** Chat interview: Towny asks one open question, turns the reply into Yes/Neutral/No answers,
 *  and the voter checks them in the buttons below. Buttons stay the fallback. Nothing is stored on a server. */
export default function TownyInterview({ zip, city, issues, onFill, answered = 0, carried = 0, savedZip = null }: { zip: string; city: string; issues: { id: string; label: string }[]; onFill: (f: Fill[]) => void; answered?: number; carried?: number; savedZip?: string | null }) {
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

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    const all = [...said, t];
    setSaid(all); setText(""); setBusy(true);
    setMsgs((m) => [...m, { from: "you", text: t }]);
    let reply: string;
    let links: { label: string; url: string }[] = [];
    try {
      const r = await fetch("/api/interview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zip, messages: all.map((x) => ({ text: x })) }) });
      const j = await r.json();
      if (!r.ok && !j.answers?.length) throw new Error(j.error?.message || "failed");
      const fills = (j.answers || []) as Fill[];
      const fresh = fills.filter((f) => !filled[f.issue]);
      const nextFilled = { ...filled }; for (const f of fills) nextFilled[f.issue] = true;
      setFilled(nextFilled);
      if (fills.length) onFill(fills);
      const left = issues.filter((i) => !nextFilled[i.id]);
      const lines = fresh.map((f) => `${issues.find((i) => i.id === f.issue)?.label}: ${LABEL[f.choice]}`);
      // QA 0e605d9: fact replies carry their sources as data; shown as real links under the reply.
      if (typeof j.reply === "string" && !fills.length && Array.isArray(j.links)) links = j.links.filter((l: { url?: unknown }) => typeof l?.url === "string" && /^https:\/\//.test(l.url as string));
      reply = typeof j.reply === "string" && !fills.length ? j.reply : ((lines.length ? `I filled in ${lines.join("; ")}. Check them below and change any that are wrong.` : "I couldn't match that to a question yet.")
        + (left.length ? ` Anything on ${left.slice(0, 3).map((i) => i.label.toLowerCase()).join(", ")}?` : " That covers every question."));
    } catch {
      reply = "I couldn't read that just now. Use the Yes, Neutral and No buttons below.";
    }
    setMsgs((m) => [...m, { from: "towny", text: reply, links }]);
    setBusy(false);
  }

  // QA P2 (4c21a5c): the carry-over is also said on the page, not only inside the chat.
  // QA P2 (9dfe90d): normal body text, and it says when the answers came from another ZIP.
  // Design p9: only answers that were saved before this page load (carried), never ones given in this session.
  const carry = carried > 0
    ? <p className="mb-3 text-base leading-6 text-black" data-carryover>{carryText(carried, zip, savedZip, answered)}</p>
    : null;
  if (!open) return (
    <div className="mt-6" data-interview>
      {carry}
      <button type="button" onClick={() => { setMsgs([{ from: "towny", text: opener(answered) }]); setOpen(true); }} data-interview-start
        className="inline-flex h-12 items-center border border-black px-5 text-base font-[530] text-black hover:bg-black hover:text-[#F2F2F2]">
        Or tell Towny in your own words
      </button>
    </div>
  );
  return (
    <div className="mt-6 max-w-2xl border border-black/15 p-4 md:p-6" data-interview>
      {carry}
      <ol className="space-y-3" aria-live="polite">
        {msgs.map((m, i) => (
          <li key={i} className={m.from === "you" ? "ml-auto max-w-[85%] bg-black px-4 py-3 text-base leading-6 text-[#F2F2F2] w-fit" : "max-w-[85%] bg-black/[0.04] px-4 py-3 text-base leading-6 text-black w-fit"} data-msg={m.from}>
            {m.text}
            {m.links?.length ? (
              <span className="mt-1 flex flex-wrap gap-x-4" data-towny-links>
                {m.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-[#3760F2] underline-offset-2 hover:underline" data-towny-source>{l.label} ↗</a>
                ))}
              </span>
            ) : null}
          </li>
        ))}
        {busy ? <li className="text-sm text-black/60">Reading what you wrote…</li> : null}
      </ol>
      {said.length < 4 ? (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="towny-say" className="sr-only">Your answer</label>
          <input id="towny-say" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} autoComplete="off" data-interview-input
            className="h-12 min-w-0 flex-1 border border-black/30 bg-transparent px-3 text-base text-black focus:border-black focus:outline-none" placeholder="Type here" />
          <button type="submit" disabled={busy || !text.trim()} data-interview-send className="h-12 bg-black px-5 text-base font-[530] text-[#F2F2F2] disabled:opacity-40">Send</button>
        </form>
      ) : null}
      <p className="mt-3 text-sm text-black/60">What you type goes to an AI model only to fill the answers. It isn&apos;t saved. Please leave out names and addresses.</p>
    </div>
  );
}

/** The carry-over notice: where the saved answers came from. */
export function carryText(n: number, zip: string, savedZip: string | null, total = n): string {
  const a = total > n ? `${n} of your ${total} answers (saved earlier)` : `Your ${n} saved answer${n === 1 ? "" : "s"}`;
  const are = n === 1 ? "is" : "are";
  const tail = "Change any of them, or use Reset my answers.";
  if (savedZip && savedZip !== zip) return `${a} came from another ZIP (${savedZip}) and ${are} filled in below. ${tail}`;
  if (savedZip === zip) return `${a} from your last visit for ${zip} ${are} filled in below. ${tail}`;
  return `${a} came from an earlier visit in this browser, possibly for another ZIP, and ${are} filled in below. ${tail}`;
}
