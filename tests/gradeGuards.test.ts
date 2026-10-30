// Design p11 item 6 as corrected by Civic (Oct 30, 12:51 AM CT): race-level grade guards.
import { describe, it, expect } from "vitest";
import { gradesForRace, gradeFor, eligibleSet, MIN_SCORED_ISSUES } from "../lib/grades.mjs";
const set = eligibleSet({ races: ["r"] });
const race = { id: "r", candidates: [{ name: "A" }, { name: "B" }] };
const ok = (agree: number, n: number, sourced = 6) => ({ status: "ok", agree, n, sourced });
describe("grade guards", () => {
  it("(a) any candidate with fewer than 3 scored issues hides letters for the whole race (fail closed)", () => {
    expect(MIN_SCORED_ISSUES).toBe(3);
    const g = gradesForRace(race, [ok(3, 3), ok(2, 2, 2)], 5, null, set);
    expect(g.grades).toEqual([null, null]);
    expect(g.hidden).toBe("scored");
    expect(gradesForRace(race, [ok(3, 3), { status: "few", agree: 0, n: 0 } as never], 5, null, set).grades).toEqual([null, null]);
  });
  it("(b) a C on 0 of 2 still shows (Ted Brown: 6 scored issues, this voter 0 of 2); n = 0 gives no letter", () => {
    const g = gradesForRace(race, [ok(0, 2), ok(2, 2)], 5, null, set);
    expect(g.grades).toEqual(["C", "B"]);
    expect(g.hidden).toBeNull();
    expect(gradeFor({ status: "ok", agree: 0, n: 0 }, false, 5, true, race, null, set)).toBeNull();
  });
  it("(c) letters only if every candidate shares at least 2 compared issues with this voter; counts stay", () => {
    const g = gradesForRace(race, [ok(3, 3), ok(1, 1)], 5, null, set);
    expect(g.grades).toEqual([null, null]);
    expect(g.hidden).toBe("overlap");
  });
  it("ineligible, judicial or unanswered races never get letters", () => {
    expect(gradesForRace({ ...race, id: "x" }, [ok(3, 3), ok(2, 2)], 5, null, set).grades).toEqual([null, null]);
    expect(gradesForRace({ ...race, judicial: true }, [ok(3, 3), ok(2, 2)], 5, null, set).grades).toEqual([null, null]);
    expect(gradesForRace(race, [ok(3, 3), ok(2, 2)], 0, null, set).grades).toEqual([null, null]);
  });
});
