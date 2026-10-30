/** Civic P2 (Oct 30 2026, 3:47 PM CT): the CA Secretary of State certified list of candidates is labeled by name, never by
 *  its bare hostname (elections.cdn.sos.ca.gov). Other links keep their hostname as the label. */
export const CA_CERT_LIST_LABEL = "California Secretary of State, certified list of candidates";
export const isCaCertList = (u: string) => /^https?:\/\/elections\.cdn\.sos\.ca\.gov\/[^?#]*cert-list-candidates\.pdf/i.test(u);
/** Display label for a source link: the named label for the CA certified list, else the hostname (www. dropped). */
export const hostLabel = (u: string, fallback: string = u): string => {
  if (isCaCertList(u)) return CA_CERT_LIST_LABEL;
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return fallback; }
};
/** Model replies (/api/towny-test): a bare "elections.cdn.sos.ca.gov" used as a label (not part of a URL) becomes the named
 *  label, but only when the reply's links on that host are all the certified list (the host also serves other PDFs). */
export function nameBareCertHost(text: string): string {
  const urls = text.match(/https?:\/\/elections\.cdn\.sos\.ca\.gov\/[^\s)\]>"']*/gi) ?? [];
  if (urls.some((u) => !isCaCertList(u))) return text;
  return text.replace(/(?<![\w./-])(?:www\.)?elections\.cdn\.sos\.ca\.gov(?![\w/-])/gi, CA_CERT_LIST_LABEL);
}
