// Generates real Towny follow-up samples by running lib/towny/followup.ts against shipped data for the 3 ZIPs.
// Usage: npx tsx scripts/followup-samples.mts > /tmp/samples.json   (no model routing unless --model; live source fetches on)
import { answerFollowup } from "../lib/towny/followup";
import { ISSUES } from "../lib/issues";

// Synthetic test answers (not a real voter's): alternating strong yes / strong no / lean yes across every issue.
const answers = Object.fromEntries(ISSUES.map((i, k) => [i.id, [5, -5, 2.5][k % 3]]));
const useModel = process.argv.includes("--model");
const cases = JSON.parse(process.argv[2] ?? "[]");
const out = [];
for (const c of cases) {
  const t0 = Date.now();
  // "offline": true simulates every source site being down, to show the retry-then-fallback path.
  const fetcher = c.offline ? (async () => { throw new Error("offline"); }) as unknown as typeof fetch : fetch;
  const r = await answerFollowup({ answers, ...c }, { useModel, fetcher });
  out.push({ input: { zip: c.zip, question: c.question, focus: c.focus ?? null, offline: !!c.offline }, ms: Date.now() - t0, ...r });
}
console.log(JSON.stringify(out, null, 2));
