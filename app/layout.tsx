import "./globals.css";
import type { Metadata } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";

// Inter Tight stands in for PP Neue Montreal (ndstudio.gov); variable, so weights 450/530 render.
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Instrument Serif stands in for america.gov's serif display headings.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "townhall.town: your ballot, explained in 60 seconds",
  description: "A nonpartisan ballot agent. Enter your ZIP, see every race on your Nov 3, 2026 ballot, sourced.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans">
        <div className="flex min-h-10 items-center justify-center bg-secondary px-4 py-2 text-nds-micro text-secondary-foreground/80">
          Independent and nonpartisan. Not a government website. Every claim links to its source.
        </div>
        {children}
      </body>
    </html>
  );
}
