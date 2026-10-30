import type { Section } from "../lib/content";

// Renders copy strings with inline [text](url) links. Server component, so all text is in the raw HTML.
export function Inline({ text, linkClass = "" }: { text: string; linkClass?: string }) {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const external = /^https?:/.test(m[2]) && !m[2].startsWith("https://townhall.town");
    out.push(
      <a key={m.index} href={m[2]} className={`relative after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']${linkClass ? ` ${linkClass}` : ""}`} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {m[1]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Home "How it works" / "Sources" blocks use h3 (16px, 530) under the page; info pages keep h2 (design p8). */
export function SectionBlock({ s, level = 2 }: { s: Section; level?: 2 | 3 }) {
  const Hn = level === 3 ? "h3" : "h2";
  return (
    <section id={s.id} className="grid gap-3 border-t border-black/15 py-10 md:grid-cols-12 md:gap-5">
      <Hn className="text-base font-[530] tracking-tight text-black md:col-span-4">{s.heading}</Hn>
      <div className="max-w-2xl space-y-4 text-base leading-relaxed text-black/70 md:col-span-8">
        {s.paragraphs?.map((p, i) => (
          <p key={i} className="max-w-[45ch]">
            <Inline text={p} />
          </p>
        ))}
        {s.items?.length ? (
          <ul className="max-w-[45ch] space-y-2">
            {s.items.map((it, i) => (
              <li key={i}>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : null}
        {s.code?.map((c, i) => (
          <pre key={i} className="overflow-x-auto bg-black/[0.04] p-4 text-sm leading-relaxed text-black">
            <code>{c}</code>
          </pre>
        ))}
      </div>
    </section>
  );
}

/** Body of a content section without its own heading, for the home's numbered sections (ndstudio-structure §3.6: purple links). */
export function SectionBody({ s }: { s: Section }) {
  return (
    <div className="max-w-2xl space-y-4 text-base leading-6 text-ink/70" data-section-body>
      {s.paragraphs?.map((p, i) => (
        <p key={i} className="max-w-[45ch]">
          <Inline text={p} linkClass="th-link" />
        </p>
      ))}
      {s.items?.length ? (
        <ul className="max-w-[45ch] space-y-2">
          {s.items.map((it, i) => (
            <li key={i}>
              <Inline text={it} linkClass="th-link" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
