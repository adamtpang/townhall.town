import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
const badge = cva("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-navy text-white",
      outline: "border border-slate-300 text-slate-700",
      muted: "bg-slate-100 text-slate-700",
      warn: "bg-amber-50 text-amber-900 border border-amber-200",
      accent: "bg-[#e7f2f8] text-[#005ea2]",
    },
  },
  defaultVariants: { variant: "default" },
});
export const Badge = ({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => <span className={cn(badge({ variant }), className)} {...p} />;
