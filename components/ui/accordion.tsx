"use client";
import * as React from "react";
import * as A from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
export const Accordion = A.Root;
export const AccordionItem = ({ className, ...p }: React.ComponentProps<typeof A.Item>) => <A.Item className={cn("border-b border-slate-200 last:border-0", className)} {...p} />;
export const AccordionTrigger = ({ className, children, ...p }: React.ComponentProps<typeof A.Trigger>) => (
  <A.Header className="flex">
    <A.Trigger className={cn("group flex flex-1 items-center justify-between gap-4 py-4 text-left font-semibold text-navy hover:underline", className)} {...p}>
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
    </A.Trigger>
  </A.Header>
);
export const AccordionContent = ({ className, ...p }: React.ComponentProps<typeof A.Content>) => <A.Content className={cn("pb-5", className)} {...p} />;
