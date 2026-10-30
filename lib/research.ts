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

/** Up to `per` verbatim sentences per issue that mention it, 40–280 chars, first-person or plan-like text only. */
export function findQuotes(text: string, issueIds: string[], per = 1, mustName?: string) {
  const sentences = text.split(/\n+|(?<=[.!?])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 280 && /[a-z]/.test(s) && !/cookie|subscribe|donate|privacy policy|javascript|copyright|©|sign up|newsletter/i.test(s) && (!mustName || new RegExp(`\\b${mustName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)));
  const out: { issue: string; quote: string }[] = [];
  const used = new Set<string>();
  for (const id of issueIds) {
    const re = ISSUE_WORDS[id]; if (!re) continue;
    let n = 0;
    for (const s of sentences) { if (n >= per) break; if (!used.has(s) && re.test(s)) { out.push({ issue: id, quote: s }); used.add(s); n++; } }
  }
  return out;
}
