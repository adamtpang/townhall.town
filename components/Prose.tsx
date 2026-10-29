import type { Section } from "../lib/content";

// Renders copy strings with inline [text](url) links. Server component, so all text is in the raw HTML.
export function Inline({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const external = /^https?:/.test(m[2]) && !m[2].startsWith("https://townhall.town");
    out.push(
      <a key={m.index} href={m[2]} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {m[1]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function SectionBlock({ s }: { s: Section }) {
  return (
    <section className="grid gap-3 border-t border-black/15 py-10 md:grid-cols-12 md:gap-5">
      <h2 className="text-base font-medium tracking-tight text-black md:col-span-4">{s.heading}</h2>
      <div className="max-w-2xl space-y-4 text-base leading-relaxed text-black/70 md:col-span-8">
        {s.paragraphs?.map((p, i) => (
          <p key={i}>
            <Inline text={p} />
          </p>
        ))}
        {s.items?.length ? (
          <ul className="space-y-2">
            {s.items.map((it, i) => (
              <li key={i}>
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
