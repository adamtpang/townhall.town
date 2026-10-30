import "./globals.css";
import type { Metadata } from "next";
import { Public_Sans, Inter_Tight } from "next/font/google";
import { SITE } from "../lib/site";

// Inter Tight is the single grotesk (ndstudio.gov style); Public Sans is the fallback. No serif.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

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
    <html lang="en" className={`${publicSans.variable} ${grotesk.variable}`}>
      <head>
        <link rel="service-desc" type="application/json" href="/openapi.json" />
        <link rel="service-doc" type="text/html" href="/developers" />
        <link rel="api-catalog" href="/.well-known/api-catalog" />
      </head>
      <body className="font-sans text-[#010101] antialiased">{children}</body>
    </html>
  );
}
