// ndstudio-structure spec §6 <SectionHeader>: numbered section on a hairline rule. Label in cols 1–4 (number in
// brand-700 tabular figures, label 14/20 at 530), content in cols 5–12. 96px rhythm at 1440, 64px at 390.
export function NumberedSection({ n, label, id, children }: { n: string; label: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-label`} className="mt-16 grid gap-x-5 gap-y-6 border-t border-ink/15 pt-16 md:grid-cols-12 lg:mt-24 lg:pt-24" data-numbered={n}>
      <h2 id={`${id}-label`} className="flex gap-3 text-sm leading-5 font-[530] tracking-normal text-ink md:col-span-4">
        <span className="tabular-nums text-brand-700">{n}</span>
        <span>{label}</span>
      </h2>
      <div className="min-w-0 md:col-span-8">{children}</div>
    </section>
  );
}
