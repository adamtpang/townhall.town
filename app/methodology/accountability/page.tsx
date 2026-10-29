import type { Metadata } from "next";
import type { ReactNode } from "react";
import { METHOD_MD } from "../../../lib/accountabilityMethod";
import { METHOD_TEXT } from "../../../lib/accountability";

export const metadata: Metadata = {
  title: "Track record method",
  description: "How townhall.town compares what candidates said with what the official record shows they did.",
  alternates: { canonical: "/methodology/accountability" },
};

/** Inline markdown: **bold**, `code`, [text](url). Plain text otherwise (no HTML injection). */
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++} className="font-[530]">{m[1]}</strong>);
    else if (m[2]) out.push(<code key={k++} className="font-mono text-[0.9em]">{m[2]}</code>);
    else out.push(<a key={k++} href={m[4]} className="text-[#3760F2] underline-offset-2 hover:underline" {...(/^https?:/.test(m[4]) ? { target: "_blank", rel: "noreferrer" } : {})}>{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function render(md: string) {
  const blocks: ReactNode[] = [];
  const lines = md.split("\n");
  let list: { depth: number; text: string }[] = [];
  let para: string[] = [];
  let k = 0;
  const flushPara = () => { if (para.length) blocks.push(<p key={k++} className="mt-4 text-base leading-7 text-black/80">{inline(para.join(" "))}</p>); para = []; };
  const flushList = () => {
    if (list.length) blocks.push(<ul key={k++} className="mt-4 list-disc space-y-1 pl-6 text-base leading-7 text-black/80">{list.map((l, i) => <li key={i} style={{ marginLeft: l.depth * 20 }}>{inline(l.text)}</li>)}</ul>);
    list = [];
  };
  for (const line of lines) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); const n = h[1].length; blocks.push(n === 1 ? <h1 key={k++} className="font-serif text-4xl leading-tight lg:text-5xl">{inline(h[2])}</h1> : <h2 key={k++} className="mt-10 font-serif text-2xl leading-8">{inline(h[2])}</h2>); }
    else if (li) { flushPara(); list.push({ depth: Math.floor(li[1].length / 2), text: li[2] }); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return blocks;
}

export default function Page() {
  return (
    <main className="mx-auto max-w-[72ch] px-5 py-16 lg:py-24">
      <p className="text-sm text-black/60"><a href="/" className="inline-flex min-h-11 items-center text-[#3760F2]">townhall.town</a></p>
      {render(METHOD_MD)}
      <h2 className="mt-10 font-serif text-2xl leading-8">Method, as shown on each candidate</h2>
      <p className="mt-4 border-l-2 border-[#3760F2] pl-4 text-base leading-7 text-black" data-method-verbatim>{METHOD_TEXT}</p>
    </main>
  );
}
