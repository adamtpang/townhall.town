export type PhotoGate = "race" | "candidate";
/** The one switch for photo display. Default "race": all-or-none per race (photos only when every candidate in the
 *  race has one). "candidate": each candidate with a photo shows it, initials for the rest.
 *  Flip per build with NEXT_PUBLIC_PHOTO_GATE=candidate (build-time env, no project setting), or change DEFAULT here. */
const DEFAULT: PhotoGate = "candidate";
export const PHOTO_GATE: PhotoGate = process.env.NEXT_PUBLIC_PHOTO_GATE === "candidate" ? "candidate" : process.env.NEXT_PUBLIC_PHOTO_GATE === "race" ? "race" : DEFAULT;
