"use client";
// Local news strip: recent election headlines from local outlets for this ZIP (data/news.json, refreshed by
// scripts/cache-news.mjs). Headline, outlet, date and link only; nothing is summarized. Renders nothing when there are
// no headlines, so an empty or stale cache never shows a broken section. Behind SHOW_NEWS (lib/flags.ts, default OFF).
import news from "../data/news.json";
import { useT } from "../lib/i18n";
import { H2 } from "../lib/typeScale";

type Item = { title: string; url: string; outlet: string; date: string };
const data = news as unknown as { fetchedAt: string | null; zips: Record<string, Item[]> };
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function LocalNews({ zip }: { zip: string }) {
  const t = useT();
  const items = data.zips[zip] ?? [];
  if (!items.length) return null;
  const outlets = [...new Set(items.map((i) => i.outlet))];
  return (
    <section className="border-t border-black py-24" id="news" aria-labelledby="news-h">
      <p className="nds-caption-upper text-black/60">{t("Local news")}</p>
      <h2 id="news-h" className={`mt-3 ${H2}`}>{t("What local reporters are covering")}</h2>
      <p className="mt-4 max-w-2xl text-black/60">{t("Recent election headlines from")} {outlets.join(", ")}. {t("Links go to each outlet. We don't summarize or endorse.")}</p>
      <ul className="mt-10 flex snap-x gap-4 overflow-x-auto pb-3">
        {items.map((i) => (
          <li key={i.url} className="w-72 shrink-0 snap-start border-t border-black/15 pt-4">
            <p className="text-sm uppercase tracking-wide text-black/60">{i.outlet} · {day(i.date)}</p>
            <a href={i.url} target="_blank" rel="noreferrer" className="mt-2 block text-lg leading-snug text-black">{i.title}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
