"use client";
import * as React from "react";
import * as S from "@radix-ui/react-slider";
import { cn } from "../../lib/utils";
export const Slider = ({ className, ...p }: React.ComponentProps<typeof S.Root>) => (
  <S.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...p}>
    <S.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-neutral-200">
      <S.Range className="absolute h-full bg-navy" />
    </S.Track>
    <S.Thumb className="relative block h-5 w-5 rounded-full after:absolute after:-inset-3 after:content-[''] border-2 border-navy bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label="Your position" />
  </S.Root>
);
