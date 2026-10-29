import type { Metadata } from "next";
import InfoPage from "../../components/InfoPage";
import { ABOUT } from "../../lib/content";

export const metadata: Metadata = {
  title: ABOUT.title,
  description: ABOUT.description,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", siteName: "townhall.town", locale: "en_US", title: ABOUT.title, description: ABOUT.description, url: "/about" },
};

export default function Page() {
  return <InfoPage page={ABOUT} />;
}
