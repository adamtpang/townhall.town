// Code-level controls that run before (and after) the model, per Civic's towny_prompt.md "Required code controls".
// Web stand-ins: there is no messaging backend, subscription list or stored sender data yet.

export const PRIVACY_URL = "https://townhall.town/privacy";

const STOP = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const HELP = new Set(["help", "info"]);
const START = new Set(["start", "unstop", "yes"]);
const DELETE = new Set(["delete my data", "delete", "forget me", "erase my data"]);

export type Keyword = "stop" | "help" | "start" | "delete";

/** Whole trimmed body, ignoring case and trailing punctuation. */
export function keywordOf(body: string): Keyword | null {
  const k = body.trim().toLowerCase().replace(/[.!]+$/, "").replace(/\s+/g, " ");
  if (STOP.has(k)) return "stop";
  if (HELP.has(k)) return "help";
  if (START.has(k)) return "start";
  if (DELETE.has(k)) return "delete";
  return null;
}

export const FIXED_REPLY: Record<Exclude<Keyword, "delete">, string> = {
  stop: "OK. Towny won't send you any more messages. Reply START if you change your mind.",
  help: `Towny gives nonpartisan, sourced information about the Nov 3, 2026 election for ZIPs 78701, 94103 and 10001. Send your ZIP and a question. Privacy: ${PRIVACY_URL}. Other places: https://vote.gov. Reply STOP to stop.`,
  start: "You're back on. Send your ZIP and a question.",
};

/** What the delete code path actually does today (web only, nothing stored server-side). */
export function deleteMyData() {
  return {
    deleted: [] as string[],
    storedOnServer: "nothing",
    message:
      "townhall.town has no accounts and does not store your messages or ZIP on its servers, so there was nothing to delete there. Issue answers you gave on the website are saved only in your own browser; clearing this site's data in your browser removes them. Standard hosting logs are kept by Vercel, the host; see " +
      PRIVACY_URL +
      ".",
  };
}

/** Short, truthful privacy summary (matches /privacy; unverified items are stated as not confirmed). */
export function getPrivacySummary() {
  return {
    summary: [
      "No account. Towny never needs your name, street address, phone number or how you vote; a ZIP is enough.",
      "townhall.town does not sell or share your data and does not save your questions or ZIP on its servers.",
      "To answer, your question (with emails, phone numbers and street addresses removed) and ZIP are sent to an AI model through Vercel AI Gateway (Google or OpenAI models), or to xAI directly if that is configured. Vercel says the gateway does not keep prompts after a request. townhall.town has not turned on zero-data-retention or no-training routing, so the AI provider's own data policy applies.",
      "Vercel, the host, keeps standard request logs (such as IP address and page path) for a limited time.",
      "Messaging by SMS, email or WhatsApp is not running yet.",
    ],
    privacyPage: PRIVACY_URL,
    contact: "https://github.com/adamtpang/townhall.town/issues (public; do not include personal details)",
  };
}

// Identifier stripping before any model call.
const PATTERNS: [string, RegExp, string][] = [
  ["email", /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email removed]"],
  ["phone", /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone removed]"],
  ["address", /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9.'-]+\s+){0,4}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Pkwy|Parkway|Hwy|Highway|Ter|Terrace|Cir|Circle|Sq|Square)\b\.?(?:\s*(?:#|Apt\.?|Unit|Suite|Ste\.?)\s*\w+)?/gi, "[address removed]"],
  ["ssn", /\b\d{3}-\d{2}-\d{4}\b/g, "[id removed]"],
];
/** Strips identifiers; `redacted` lists the kinds removed (email, phone, address, ssn). */
export function redact(text: string): { text: string; redacted: string[] } {
  let out = text;
  const kinds: string[] = [];
  for (const [kind, re, rep] of PATTERNS) {
    const next = out.replace(re, rep);
    if (next !== out) kinds.push(kind);
    out = next;
  }
  return { text: out, redacted: kinds };
}

// Output check: phrases that must never reach a voter.
const BANNED: [string, RegExp][] = [
  ["vote for", /\bvote for\b/i],
  ["best candidate", /\bbest candidate\b/i],
  ["you should vote", /\byou should vote\b/i],
  ["match", /\bmatch(es|ed|ing)?\b/i],
  ["text your vote", /\btext your vote\b/i],
  ["vote online", /\bvote online\b/i],
  ["best", /\bbest\b/i],
  ["likely to win", /\blikely to win\b/i],
];
/** Phrases found in a reply. A hit means the reply needs review before it is sent; quoting a voter's banned phrase still counts. */
export function outputFlags(reply: string): string[] {
  return BANNED.filter(([, re]) => re.test(reply)).map(([k]) => k);
}
