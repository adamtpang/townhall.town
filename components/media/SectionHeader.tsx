// ndstudio-structure spec §6 <SectionHeader>: numbered section on a hairline rule. Label in cols 1–4 (number in
// brand-700 tabular figures, label 14/20 at 530), content in cols 5–12. Grid spec (Oct 30): py-16 / lg:py-24, no ad-hoc
// margins; the first section under the ZIP box is tight (py-8) so the city row stays in the first screen.
// Hard cut list H1/H2 (Design, Oct 30 ~3:09 PM CT): fold=true puts the body behind the section's own heading (native
// <details>, no motion JS on home; Ctrl+F still opens it). No new copy: the summary is the existing label.
export function NumberedSection({ n, label, id, children, wide = false, first = false, fold = false }: { n: string; label: string; id: string; children: React.ReactNode; wide?: boolean; first?: boolean; fold?: boolean }) {
  if (fold) return (
    <section id={id} aria-labelledby={`${id}-label`} className="border-t border-ink/15 py-16 lg:py-24" data-numbered={n} data-section-fold>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <h2 id={`${id}-label`} className="flex gap-3 text-sm leading-5 font-[530] tracking-normal text-ink">
            <span className="tabular-nums text-brand-700">{n}</span>
            <span>{label}</span>
          </h2>
          <svg aria-hidden data-chev viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-black/60 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="grid gap-x-4 pt-6 md:grid-cols-12 lg:gap-x-6"><div className="min-w-0 md:col-span-8 md:col-start-5">{children}</div></div>
      </details>
    </section>
  );
  return (
    <section id={id} aria-labelledby={`${id}-label`} className={`grid gap-x-4 border-t border-ink/15 md:grid-cols-12 lg:gap-x-6 ${first ? "gap-y-4 py-8" : "gap-y-6 py-16 lg:py-24"}`} data-numbered={n}>
      <h2 id={`${id}-label`} className={`flex gap-3 text-sm leading-5 font-[530] tracking-normal text-ink ${wide ? "md:col-span-12" : "md:col-span-4"}`}>
        <span className="tabular-nums text-brand-700">{n}</span>
        <span>{label}</span>
      </h2>
      {/* wide: the label sits on its own row and the content takes all 12 columns (grid spec #3, city cards). */}
      <div className={wide ? "min-w-0 md:col-span-12" : "min-w-0 md:col-span-8"}>{children}</div>
    </section>
  );
}
