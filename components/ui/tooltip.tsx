"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
export const TooltipProvider = T.Provider;
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-50 max-w-xs rounded bg-navy px-3 py-2 text-xs leading-snug text-white shadow-lg">
          {label}
          <T.Arrow className="fill-navy" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
