import type { Metadata } from "next";
import InfoPage from "../../components/InfoPage";
import { DEVELOPERS } from "../../lib/content";

export const metadata: Metadata = {
  // Absolute, so the layout template does not append "| townhall.town" a second time.
  title: { absolute: DEVELOPERS.title },
  description: DEVELOPERS.description,
  alternates: { canonical: "/developers" },
  openGraph: { type: "website", siteName: "townhall.town", locale: "en_US", title: DEVELOPERS.title, description: DEVELOPERS.description, url: "/developers" },
};

export default function Page() {
  return <InfoPage page={DEVELOPERS} />;
}
