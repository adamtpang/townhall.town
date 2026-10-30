// node scripts/photo-parity.mjs -> party photo parity for both photo modes (QA fb66b9b P0). Writes /tmp/photo-parity.json.
import { execSync } from "node:child_process";
import fs from "node:fs";
const out = process.env.PARITY_OUT || "/tmp/photo-parity.json";
execSync("npx vitest run tests/photoParity.test.ts", { stdio: "inherit", env: { ...process.env, PARITY_OUT: out } });
const d = JSON.parse(fs.readFileSync(out, "utf8"));
for (const [mode, s] of Object.entries({ "A race": d.race, "B candidate": d.candidate }))
  console.log(`${mode}: races ${s.races}, pictured ${s.pictured}, partly pictured ${s.partly.length}, D-vs-R one-party ${s.oneParty.length}, Dems ${s.dem.shown}/${s.dem.of}, Reps ${s.rep.shown}/${s.rep.of}, candidates ${s.cands.shown}/${s.cands.of}`);
for (const x of d.candidate.oneParty) console.log("  B one-party:", x);
for (const x of d.candidate.partly) console.log("  B partly:", x);
