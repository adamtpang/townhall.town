"use client";
import * as React from "react";
import * as A from "@radix-ui/react-avatar";
import { cn } from "../../lib/utils";
export const Avatar = ({ className, ...p }: React.ComponentProps<typeof A.Root>) => <A.Root className={cn("relative flex h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200", className)} {...p} />;
export const AvatarImage = ({ className, ...p }: React.ComponentProps<typeof A.Image>) => <A.Image className={cn("h-full w-full object-cover object-top", className)} {...p} />;
export const AvatarFallback = ({ className, ...p }: React.ComponentProps<typeof A.Fallback>) => <A.Fallback className={cn("flex h-full w-full items-center justify-center text-base font-semibold text-slate-600", className)} {...p} />;
