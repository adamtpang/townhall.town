// Refreshes data/finance.json from the FEC API (federal candidates only).
// Run: FEC_API_KEY=... node scripts/cache-finance.mjs   (behind a proxy add NODE_USE_ENV_PROXY=1)
// Free key: https://api.data.gov/signup . DEMO_KEY works but is rate limited.
// Shows employers and committees only, never individual donor names (52 U.S.C. 30111(a)(4)).
import fs from "node:fs";

const KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const API = "https://api.open.fec.gov/v1";
const CYCLE = 2026;
const NOT_EMPLOYERS = /^(NOT EMPLOYED|SELF[- ]EMPLOYED|NONE|NULL|N\/?A|INFORMATION REQUESTED.*|REQUESTED|UNEMPLOYED|RETIRED|HOMEMAKER|STUDENT|-)$/i;
// Form 3 receipt lines from committees: 11B party, 11C other committees (PACs), 12 transfers (joint fundraising).
const COMMITTEE_LINES = { "11B": "party", "11C": "PAC", "12": "joint fundraising" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: KEY });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}${path}?${qs}`);
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    await sleep(250);
    return r.json();
  }
  throw new Error(`${path} rate limited`);
}

function federalCandidates() {
  const tx = JSON.parse(fs.readFileSync("data/tx.json", "utf8"));
  const ballots = JSON.parse(fs.readFileSync("data/ballots.json", "utf8"));
  const races = [...tx.statewide, ...Object.values(tx.house), ...Object.values(ballots).flatMap((b) => b.races)];
  const out = new Map();
  for (const r of races) for (const c of r.candidates) {
    const id = c.finance?.url?.match(/fec\.gov\/data\/candidate\/([A-Z0-9]+)/)?.[1];
    if (id && !out.has(id)) out.set(id, { name: c.name, state: id.slice(2, 4) });
  }
  return out;
}

async function summarize(id, state) {
  const totals = (await get(`/candidate/${id}/totals/`, { cycle: CYCLE })).results[0];
  if (!totals) return { status: "no filings" };
  const cmte = (await get(`/candidate/${id}/committees/`, { designation: "P", cycle: CYCLE })).results[0];
  const indiv = totals.individual_contributions || 0;
  const out = {
    raised: totals.receipts, spent: totals.disbursements, cashOnHand: totals.last_cash_on_hand_end_period,
    individual: indiv,
    smallDonorPct: indiv > 0 ? totals.individual_unitemized_contributions / indiv : null,
    coverageThrough: totals.coverage_end_date?.slice(0, 10) ?? null,
    lastReport: totals.last_report_type_full ?? null,
    committee: cmte ? { id: cmte.committee_id, name: cmte.name } : null,
    source: { label: "FEC candidate totals", url: `https://www.fec.gov/data/candidate/${id}/?cycle=${CYCLE}` },
  };
  const states = (await get(`/schedules/schedule_a/by_state/by_candidate/`, { candidate_id: id, cycle: CYCLE, election_full: true, per_page: 100 })).results;
  const stateTotal = states.reduce((n, s) => n + s.total, 0);
  out.inStatePct = stateTotal > 0 ? states.filter((s) => s.state === state).reduce((n, s) => n + s.total, 0) / stateTotal : null;
  if (cmte) {
    const emp = (await get(`/schedules/schedule_a/by_employer/`, { committee_id: cmte.committee_id, cycle: CYCLE, sort: "-total", per_page: 30 })).results;
    out.topEmployers = emp.filter((e) => e.employer && !NOT_EMPLOYERS.test(e.employer.trim())).slice(0, 5).map((e) => ({ name: e.employer, total: e.total }));
    const rows = (await get(`/schedules/schedule_a/`, { committee_id: cmte.committee_id, two_year_transaction_period: CYCLE, is_individual: false, sort: "-contribution_receipt_amount", per_page: 100 })).results;
    const agg = new Map();
    for (const r of rows) {
      const kind = COMMITTEE_LINES[r.line_number];
      if (!kind || r.memo_code === "X" || !r.contributor_name) continue;
      const k = r.contributor_name.trim();
      agg.set(k, { name: k, kind, total: (agg.get(k)?.total || 0) + r.contribution_receipt_amount });
    }
    out.topCommittees = [...agg.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    out.donorsSource = { label: "FEC itemized receipts", url: `https://www.fec.gov/data/receipts/?committee_id=${cmte.committee_id}&two_year_transaction_period=${CYCLE}` };
  }
  return out;
}

const cands = federalCandidates();
const result = { fetchedAt: new Date().toISOString(), cycle: CYCLE, candidates: {} };
let i = 0;
for (const [id, c] of cands) {
  i++;
  try {
    result.candidates[id] = { name: c.name, ...(await summarize(id, c.state)) };
    console.log(`${i}/${cands.size} ${id} ${c.name}: raised ${Math.round(result.candidates[id].raised ?? 0)}`);
  } catch (e) {
    console.error(`${i}/${cands.size} ${id} ${c.name}: ${e.message}`);
  }
}
fs.writeFileSync("data/finance.json", JSON.stringify(result, null, 1));
console.log("wrote data/finance.json:", Object.keys(result.candidates).length, "candidates");
