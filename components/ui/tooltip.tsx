"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
export const TooltipProvider = T.Provider;
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="glass z-50 max-w-xs rounded-xl px-3 py-2 text-sm leading-5 text-black">{/* Premium §1: popovers are glass, rounded-xl (the one radius on the site), 14px ink. */}
          {label}
          <T.Arrow className="fill-white/75" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
