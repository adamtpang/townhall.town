// Towny live research: reads only the candidate's own listed pages (campaign site, official site, Ballotpedia)
// and returns verbatim sentences with the URL they came from. Nothing is inferred, scored or counted in overlap.
export const ISSUE_WORDS: Record<string, RegExp> = {
  housing: /\b(housing|rent|renters?|homeless\w*|affordab\w+ hom\w*|zoning)\b/i,
  healthcare: /\b(health ?care|medicaid|medicare|insurance|hospital|clinic|mental health)\b/i,
  wages: /\b(wages?|minimum wage|paychecks?|jobs|workers?|labor|unions?)\b/i,
  taxes: /\b(tax(es)?|property tax|tax rate|budget)\b/i,
  safety: /\b(public safety|police|policing|crime|law enforcement|jail|prosecut\w+)\b/i,
  education: /\b(schools?|education|teachers?|vouchers?|students?)\b/i,
  energy: /\b(energy|power grid|grid|ercot|renewables?|solar|wind power|oil and gas|climate)\b/i,
  immigration: /\b(immigra\w+|border|deport\w*|asylum)\b/i,
  wealthtax: /\b(wealth tax|billionaires?|large fortunes)\b/i,
  infrastructure: /\b(infrastructure|water supply|water|roads?|transit|bridges?|flood\w*)\b/i,
};

export function textOf(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|section|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&#\d+;/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VERB = "(?:said|says|wrote|writes|told|tells|added|adds|stated|states|explained|explains|argued|argues|declared|promised|pledged)";

/**
 * Civic rule (b): a research quote is shown only if it is the candidate's own words, inside quotation marks in the
 * fetched page text, with the candidate named as the speaker right next to it ("…," Smith said / Smith said: "…").
 * The returned quote is an exact substring of `text`. Reporter narration, unquoted page copy and pronoun-only
 * attributions ("she said") never count. Same rule for every candidate and every third-party page. On the candidate's
 * own campaign or official site, findOwnWords also applies (QA P1 #1).
 * Issue words only pick which quotes are relevant to the voter's answers; they are never shown as tags.
 */
export function findQuotes(text: string, issueIds: string[], per = 1, fullName = "") {
  const parts = fullName.split(/\s+/).filter((w) => w && !/^(jr\.?|sr\.?|ii|iii|iv|[a-z]\.)$/i.test(w));
  const last = parts[parts.length - 1] || "";
  if (!last) return [];
  // Speaker: the last name, optionally preceded by first/middle names or a title, e.g. "Jane Q. Smith" or "Rep. Smith".
  const who = `(?:[A-Z][\\w.'’-]*\\s+){0,3}${esc(last)}(?![’']s\\b)`;
  const after = new RegExp(`^[\\s,]*(?:${VERB}\\s+${who}|${who}\\s*(?:,[^,"“”]{0,60},\\s*)?${VERB})\\b`);
  const before = new RegExp(`${who}\\s*(?:,[^,"“”]{0,60},\\s*)?${VERB}\\b[^"“”.!?]{0,50}?[\\s,:]*$`);
  const quoteRe = /“([^“”]{40,400}?)”|"([^"\n]{40,400}?)"/g;
  const found: { quote: string; issueOk: (re: RegExp) => boolean }[] = [];
  for (const m of text.matchAll(quoteRe)) {
    const inner = (m[1] ?? m[2]).trim().replace(/[,;:]$/, "");
    const i = m.index!;
    const pre = text.slice(Math.max(0, i - 120), i);
    const post = text.slice(i + m[0].length, i + m[0].length + 120);
    if (!(after.test(post) || before.test(pre.split(/\n/).pop() || ""))) continue;
    if (!/[a-z]/.test(inner) || inner.split(/\s+/).length < 7) continue;
    if (!text.includes(inner)) continue; // exact substring of the fetched text
    found.push({ quote: inner, issueOk: (re) => re.test(inner) });
  }
  const out: { issue: string; quote: string }[] = [];
  const used = new Set<string>();
  for (const id of issueIds) {
    const re = ISSUE_WORDS[id]; if (!re) continue;
    let n = 0;
    for (const f of found) { if (n >= per) break; if (!used.has(f.quote) && f.issueOk(re)) { out.push({ issue: id, quote: f.quote }); used.add(f.quote); n++; } }
  }
  return out;
}

/** Same registrable host (www. and subdomains ignored), so a candidate's own campaign or official site is recognised. */
export function sameSite(a: string, b: string) {
  const h = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase().split(".").slice(-2).join("."); } catch { return ""; } };
  const x = h(a); return !!x && x === h(b);
}

/** Issue pages linked from the candidate's own site (same site, path like /priorities, /issues, /platform). */
export function ownIssueLinks(html: string, base: string, max = 2): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    let u: string; try { u = new URL(m[1], base).toString(); } catch { continue; }
    if (!/^https:\/\//.test(u) || !sameSite(u, base)) continue;
    if (!/\/(priorities|issues|platform|plan|plans|agenda|vision|policy|policies|positions)(\/|$)/i.test(new URL(u).pathname)) continue;
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * QA P1 #1: text on the candidate's OWN campaign or official site counts as their own words, without quotation
 * marks. A sentence qualifies if it is a whole sentence (7-60 words), is an exact substring of the page text, and
 * is not inside quotation marks (quoted text on their site may be someone else, e.g. an endorser, so it still needs
 * the named-speaker rule via findQuotes). Same rule for every candidate.
 */
export function findOwnWords(text: string, issueIds: string[], per = 1) {
  const quoted: [number, number][] = [];
  for (const m of text.matchAll(/“[^“”]*”|"[^"\n]*"/g)) quoted.push([m.index!, m.index! + m[0].length]);
  const inQuote = (i: number, j: number) => quoted.some(([a, b]) => i < b && j > a);
  const found: string[] = [];
  for (const m of text.matchAll(/[A-Z][^.!?\n“”"]{30,400}[.!?]/g)) {
    const s = m[0].trim(); const i = m.index!;
    if (inQuote(i, i + m[0].length)) continue;
    const w = s.split(/\s+/).length; if (w < 7 || w > 60) continue;
    if (!/[a-z]/.test(s) || !text.includes(s)) continue; // exact substring of the fetched text
    if (!found.includes(s)) found.push(s);
  }
  const out: { issue: string; quote: string }[] = []; const used = new Set<string>();
  for (const id of issueIds) {
    const re = ISSUE_WORDS[id]; if (!re) continue; let n = 0;
    for (const q of found) { if (n >= per) break; if (!used.has(q) && re.test(q)) { out.push({ issue: id, quote: q }); used.add(q); n++; } }
  }
  return out;
}
