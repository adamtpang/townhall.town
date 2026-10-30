import type { Metadata } from "next";
import InfoPage from "../../components/InfoPage";
import { PRIVACY } from "../../lib/content";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
  openGraph: { type: "website", siteName: "townhall.town", locale: "en_US", title: PRIVACY.title, description: PRIVACY.description, url: "/privacy" },
};

export default function Page() {
  return <InfoPage page={PRIVACY} />;
}
