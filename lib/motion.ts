// Design premium spec §2.1 (Oct 30 2026): the only place motion durations and curves live.
export const ease = { out: [0.215, 0.61, 0.355, 1] as const, inOut: [0.65, 0, 0.35, 1] as const }; // ease.out = --ease-out-nd
export const dur = { fast: 0.15, base: 0.22, slow: 0.32 }; // seconds
export const spring = {
  layout: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as const, // ~250ms settle, no overshoot
  sheet: { type: "spring", stiffness: 360, damping: 36 } as const,
};
export const enter = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: dur.base, ease: ease.out } };
export const exit = { opacity: 0, y: 4, transition: { duration: dur.fast, ease: ease.out } };
export const stagger = { staggerChildren: 0.06, delayChildren: 0.04 }; // 60ms
/** Folder body: height to auto. Reduced motion: height instant, opacity only. */
export const accordion = (open: boolean, reduce: boolean | null) => ({
  animate: { height: open ? "auto" : 0, opacity: open ? 1 : 0 },
  transition: { height: { duration: reduce ? 0 : dur.base, ease: ease.out }, opacity: { duration: dur.fast } },
});
export const reduced = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: dur.fast } };
/** Max children that animate on arrival; the rest appear instantly. */
export const MAX_STAGGER = 6;
