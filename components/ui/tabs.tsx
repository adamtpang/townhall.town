"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";
export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof T.List>) => <T.List className={cn("inline-flex flex-wrap gap-1 rounded-md bg-slate-100 p-1", className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof T.Trigger>) => (
  <T.Trigger className={cn("rounded px-3 py-1.5 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-navy data-[state=active]:shadow-sm", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>) => <T.Content className={cn("mt-4 focus:outline-none", className)} {...p} />;
