import type { Metadata } from "next";
import InfoPage from "../../components/InfoPage";
import { DEVELOPERS } from "../../lib/content";

export const metadata: Metadata = {
  title: DEVELOPERS.title,
  description: DEVELOPERS.description,
  alternates: { canonical: "/developers" },
  openGraph: { type: "website", siteName: "townhall.town", locale: "en_US", title: DEVELOPERS.title, description: DEVELOPERS.description, url: "/developers" },
};

export default function Page() {
  return <InfoPage page={DEVELOPERS} />;
}
