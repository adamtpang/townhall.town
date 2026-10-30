"use client";
// Spec §2.4: only m + LazyMotion on the route; the animation features arrive in their own lazy chunk. This shell lives
// inside the results chunk (RaceTiers is loaded after a ZIP is submitted), so home never fetches the features.
import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";
const features = () => import("../lib/motion-features").then((m) => m.default);
export default function MotionShell({ children }: { children: ReactNode }) {
  return <LazyMotion features={features} strict><MotionConfig reducedMotion="user">{children}</MotionConfig></LazyMotion>;
}
