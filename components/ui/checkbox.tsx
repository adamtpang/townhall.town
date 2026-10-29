"use client";
import * as React from "react";
import * as C from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
export const Checkbox = ({ className, ...p }: React.ComponentProps<typeof C.Root>) => (
  <C.Root className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-slate-400 bg-white data-[state=checked]:border-navy data-[state=checked]:bg-navy", className)} {...p}>
    <C.Indicator><Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /></C.Indicator>
  </C.Root>
);
