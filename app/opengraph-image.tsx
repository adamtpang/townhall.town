import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { COVERAGE, SITE } from "../lib/site";

export const alt = "townhall.town: your ballot, explained. Nonpartisan ballot guide.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Site look: #f2f2f2 ground with a faint 48px grid, Inter Tight display line (530) and body (450), blue square mark. No serif (#27).
// Satori only takes weights in hundreds, so the 450 and 530 static instances are registered as 400 and 500.
export default async function Image() {
  const [regular, medium] = await Promise.all(["450", "530"].map((w) => readFile(join(process.cwd(), `assets/fonts/InterTight-${w}.ttf`))));
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
          color: "#010101",
          fontFamily: "Inter Tight",
          fontWeight: 400,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 22, height: 22, backgroundColor: "#3760f2" }} />
            <span>{SITE.name}</span>
          </div>
          <span style={{ color: "rgba(1,1,1,0.5)" }}>{SITE.electionLabel}</span>
        </div>
        <div style={{ display: "flex", fontFamily: "Inter Tight", fontWeight: 500, fontSize: 132, lineHeight: 0.9, letterSpacing: "-0.02em" }}>
          Your ballot, explained.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "rgba(1,1,1,0.6)", borderTop: "1px solid rgba(1,1,1,0.15)", paddingTop: 28 }}>
          <span>Nonpartisan. Every fact sourced.</span>
          <span>{COVERAGE.map((c) => c.place.split(",")[0]).join(" · ")}</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter Tight", data: regular, style: "normal", weight: 400 }, { name: "Inter Tight", data: medium, style: "normal", weight: 500 }] }
  );
}
