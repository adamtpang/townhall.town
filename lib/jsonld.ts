// Homepage JSON-LD (schema.org). No PostalAddress, email or phone by design: the project does not publish
// personal contact details. Support goes through GitHub issues.
import { SITE } from "./site";

export function homeJsonLd() {
  const orgId = `${SITE.url}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        description: SITE.description,
        url: SITE.url,
        applicationCategory: "ReferenceApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript for ballot lookups",
        isAccessibleForFree: true,
        inLanguage: "en-US",
        license: "https://opensource.org/licenses/MIT",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        sameAs: [SITE.github],
        author: { "@type": "Person", name: SITE.author },
        publisher: { "@id": orgId },
      },
      {
        "@type": "Organization",
        "@id": orgId,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/icon.svg`,
        sameAs: [SITE.github],
        founder: { "@type": "Person", name: SITE.author },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: SITE.issues,
          availableLanguage: "English",
        },
      },
      {
        "@type": "WebAPI",
        "@id": `${SITE.url}/#api`,
        name: "townhall.town API",
        description: "Free, keyless JSON API for the sourced ballot data shown on townhall.town: GET or POST /api/agent with a 5-digit ZIP, and GET /api/locate with lat and lon.",
        url: `${SITE.url}/developers`,
        documentation: `${SITE.url}/openapi.json`,
        termsOfService: `${SITE.url}/developers`,
        isAccessibleForFree: true,
        provider: { "@id": orgId },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        name: SITE.name,
        url: SITE.url,
        inLanguage: "en-US",
        publisher: { "@id": orgId },
      },
    ],
  };
}

/** Serialize for a <script type="application/ld+json"> tag, escaping "<" so content cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
