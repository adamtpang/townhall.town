import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "townhall.town: your ballot, explained in 60 seconds",
  description: "A nonpartisan ballot agent. Enter your ZIP, see every race on your Nov 3, 2026 ballot, sourced.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
