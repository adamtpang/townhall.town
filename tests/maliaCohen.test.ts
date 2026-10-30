// Civic final (Oct 30): ballot name "Malia M. Cohen" resolves to stances.json "malia-m-cohen"; the older
// "malia-cohen" key is never mapped or merged, so none of its lines appear.
import { describe, it, expect } from "vitest";
import stances from "../data/stances.json";
import { stanceKey, stancesFor } from "../lib/issues";
import { answerFollowup } from "../lib/towny/followup";

const S = (stances as { stances: Record<string, Record<string, unknown>> }).stances;
const lines = (rec: Record<string, unknown>) =>
  Object.values(rec).flatMap((v) => (v && typeof v === "object" ? [(v as { quote?: string }).quote, (v as { summary?: string }).summary] : [])).filter((x): x is string => !!x);

describe("Malia M. Cohen stance key", () => {
  it("resolves to malia-m-cohen", () => {
    expect(stanceKey("Malia M. Cohen")).toBe("malia-m-cohen");
    expect(S["malia-m-cohen"]).toBeTruthy();
  });
  it("shows none of malia-cohen's lines", async () => {
    const own = new Set(lines(S["malia-m-cohen"]));
    const old = lines(S["malia-cohen"]).filter((l) => !own.has(l));
    expect(old.length).toBeGreaterThan(0);
    const shown = JSON.stringify(stancesFor("Malia M. Cohen"));
    for (const l of old) expect(shown).not.toContain(l);
    const a = await answerFollowup({ zip: "94103", question: "Where does Malia M. Cohen stand?", answers: {} } as never, { useModel: false, live: false });
    for (const l of old) expect(a.reply).not.toContain(l);
  });
  it("counts only malia-m-cohen's eligible stances", () => {
    const counted = Object.values(stancesFor("Malia M. Cohen")).filter((s) => s.value !== null && s.value !== undefined).length;
    console.log(`MALIA_COUNTED=${counted}`);
    expect(counted).toBe(4); // energy, housing, healthcare, wages (Oct 30 data)
  });
});
