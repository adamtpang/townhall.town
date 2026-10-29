import "./globals.css";
import type { Metadata } from "next";
import { Public_Sans, Instrument_Serif, Inter_Tight } from "next/font/google";
import { SITE } from "../lib/site";

// Public Sans (USWDS) stays the UI face; Instrument Serif (PR #2) is available as font-serif for display accents.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s | townhall.town" },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.github }],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US", url: "/", title: SITE.title, description: SITE.description },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${serif.variable} ${grotesk.variable}`}>
      <head>
        <link rel="service-desc" type="application/json" href="/openapi.json" />
        <link rel="service-doc" type="text/html" href="/developers" />
        <link rel="api-catalog" href="/.well-known/api-catalog" />
      </head>
      <body className="font-sans text-[#010101] antialiased">{children}</body>
    </html>
  );
}
