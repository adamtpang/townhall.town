"use client";
// Under each compared race's candidate list (Who in Your plan, and the ballot card): Design p12 #1's single photo
// credit line, then, when letters were removed (eligibility gate, guard (a) or (c)), Adam's explainer line, verbatim.
import { RaceCredits, type Photo } from "./Portrait";
import { labels } from "./PortraitRow";
import { GRADES_ABSENT_LINE } from "../lib/grades.mjs";

export default function RaceFooter({ cands, gradesHidden }: { cands: { name: string; photo?: Photo }[]; gradesHidden: string | null }) {
  const L = labels(cands.map((c) => c.name));
  return (
    <>
      <RaceCredits cands={cands} label={(n) => L[cands.findIndex((c) => c.name === n)].label} />
      {gradesHidden ? <p className="text-sm leading-5 text-black/60" data-grades-absent={gradesHidden}>{GRADES_ABSENT_LINE}</p> : null}
    </>
  );
}
