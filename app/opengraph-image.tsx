import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { COVERAGE, SITE } from "../lib/site";
import { getRaces } from "../lib/tools";

export const alt = "townhall.town: a ballot for one ZIP code, each race and measure with a source tag. Nonpartisan.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#010101";
const PURPLE = "#862F9F";
const host = (u: unknown) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return "source"; } };

/** Four real rows from the first covered ZIP's ballot, read at render time: three races and one measure. Office and
 *  measure titles only, never candidate names. Each row's tag is the host of the record it cites. */
function ballotRows(zip: string) {
  const b = getRaces(zip);
  const pick = [...b.races.slice(0, 3), ...b.measures.slice(0, 1)];
  // A measure shows its name up to the colon ("City of Austin Proposition A"), so no row is cut off mid-title.
  return pick.map((r) => ({ title: r.title.split(":")[0].trim(), source: host(typeof r.source === "string" ? r.source : (r.source as { url?: string } | undefined)?.url) }));
}

// Site look: #f2f2f2 ground with a faint 48px grid, Inter Tight display line (530) and body (450), purple (brand-600) square mark. No serif (#27).
// Satori only takes weights in hundreds, so the 450 and 530 static instances are registered as 400 and 500.
// Left: the homepage H1. Right: a ballot card for COVERAGE[0], the way the page shows it (ZIP in, races out, a source on each).
export default async function Image() {
  const [regular, medium] = await Promise.all(["450", "530"].map((w) => readFile(join(process.cwd(), `assets/fonts/InterTight-${w}.ttf`))));
  const first = COVERAGE[0];
  const rows = ballotRows(first.zip);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#f2f2f2",
          backgroundImage:
            "linear-gradient(to right, rgba(1,1,1,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(1,1,1,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          color: INK,
          fontFamily: "Inter Tight",
          fontWeight: 400,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30 }}>
          <div style={{ width: 22, height: 22, backgroundColor: PURPLE }} />
          <span>{SITE.name}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
            <div style={{ display: "flex", fontWeight: 500, fontSize: 88, lineHeight: 0.95, letterSpacing: "-0.02em" }}>Know your ballot in 2 minutes.</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "rgba(1,1,1,0.6)" }}>Nonpartisan. Every fact sourced.</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: "#ffffff", border: "1px solid rgba(1,1,1,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 28px", borderBottom: "1px solid rgba(1,1,1,0.15)", fontSize: 24 }}>
              <div style={{ display: "flex", padding: "6px 12px", backgroundColor: PURPLE, color: "#ffffff", fontWeight: 500 }}>{first.zip}</div>
              <span>{first.place}</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.title}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 28px", borderTop: i ? "1px solid rgba(1,1,1,0.08)" : "none", fontSize: 24 }}
              >
                <span style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.title}</span>
                <span style={{ display: "flex", padding: "4px 10px", border: `1px solid ${PURPLE}`, color: PURPLE, fontSize: 18 }}>source</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "rgba(1,1,1,0.6)", borderTop: "1px solid rgba(1,1,1,0.15)", paddingTop: 24 }}>
          {COVERAGE.map((c) => c.place.split(",")[0]).join(" · ")}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter Tight", data: regular, style: "normal", weight: 400 }, { name: "Inter Tight", data: medium, style: "normal", weight: 500 }] }
  );
}
