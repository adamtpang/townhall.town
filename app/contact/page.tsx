import type { Metadata } from "next";
import InfoPage from "../../components/InfoPage";
import { CONTACT } from "../../lib/content";

export const metadata: Metadata = {
  title: CONTACT.title,
  description: CONTACT.description,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", siteName: "townhall.town", locale: "en_US", title: CONTACT.title, description: CONTACT.description, url: "/contact" },
};

export default function Page() {
  return <InfoPage page={CONTACT} />;
}
