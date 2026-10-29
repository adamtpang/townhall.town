import "./globals.css";
import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";

const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

export const metadata: Metadata = {
  title: "townhall.town: your ballot, explained in 60 seconds",
  description: "A nonpartisan ballot agent. Enter your ZIP and see every race on your Nov 3, 2026 ballot, with sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
