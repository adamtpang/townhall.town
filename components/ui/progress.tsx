"use client";
import * as React from "react";
import * as P from "@radix-ui/react-progress";
import { cn } from "../../lib/utils";
export const Progress = ({ className, value = 0, ...p }: React.ComponentProps<typeof P.Root>) => (
  <P.Root className={cn("relative h-2 w-full overflow-hidden rounded-none bg-black/10", className)} value={value} {...p}>
    <P.Indicator className="h-full bg-black transition-all" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </P.Root>
);
