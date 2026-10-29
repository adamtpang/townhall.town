import "./globals.css";
import type { Metadata } from "next";
import { Public_Sans, Instrument_Serif, Inter_Tight } from "next/font/google";

// Public Sans (USWDS) stays the UI face; Instrument Serif (PR #2) is available as font-serif for display accents.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "townhall.town: your ballot, explained in seconds",
  description: "A nonpartisan ballot agent. Enter your ZIP and see every race on your Nov 3, 2026 ballot, with sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${serif.variable} ${grotesk.variable}`}>
      <body className="font-sans text-[#010101] antialiased">{children}</body>
    </html>
  );
}
