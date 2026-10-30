import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [touch-action:manipulation] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-brand-700 text-white [@media(hover:hover)]:hover:bg-brand-900 active:bg-brand-900",
        outline: "border border-black/45 bg-transparent text-black hover:border-black [@media(hover:hover)]:hover:bg-brand-50",
        ghost: "bg-transparent text-black hover:text-brand-700",
      },
      size: { default: "h-11 px-5 text-sm", sm: "min-h-11 rounded-full px-4 py-2 text-sm", lg: "h-16 px-8 text-lg" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

// Purple palette (Design Oct 30): the brand colours live here, not in call sites. Older call sites pass the
// pre-purple ink overrides (bg-black, hover:bg-black/80, text-[#f2f2f2]); on the default variant those are dropped
// so the variant's brand-700 fill wins without touching each feature file (keeps rebases on feature branches clean).
const LEGACY_INK = /^(?:(?:hover|active):)?bg-black(?:\/\d+)?$|^text-\[#f2f2f2\]$/i;
const dropLegacyInk = (c?: string) => c?.split(/\s+/).filter((t) => !LEGACY_INK.test(t)).join(" ");

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...p }, ref) => (
  <button ref={ref} className={cn(button({ variant, size }), (variant ?? "default") === "default" ? dropLegacyInk(className) : className)} {...p} />
));
Button.displayName = "Button";
/** Button look for a real link (QA a11y P2: navigation is an <a>, not a button that calls window.open). */
export const buttonClass = (className?: string, variant: VariantProps<typeof button>["variant"] = "default") => cn(button({ variant }), variant === "default" ? dropLegacyInk(className) : className);
