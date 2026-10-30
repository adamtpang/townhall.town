import "./globals.css";
import type { Metadata } from "next";
import { Public_Sans, Inter_Tight } from "next/font/google";

// Inter Tight is the single grotesk (ndstudio.gov style); Public Sans is the fallback. No serif.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: "townhall.town: your ballot, explained in seconds",
  description: "A nonpartisan ballot agent. Enter your ZIP and see every race on your Nov 3, 2026 ballot, with sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${grotesk.variable}`}>
      <body className="font-sans text-[#010101] antialiased">{children}</body>
    </html>
  );
}
