"use client";
// The one "Print or download your ballot" button (Adam approved the label). Same component on /card (prints in place),
// the ZIP results page and the interview end screen (both open /card?zip=…&print=1, which prints once it has rendered).
// 48px tall, brand-700 fill, white 16px text.
import { PRINT_CTA } from "../lib/printText";

export const PRINT_BUTTON_CLASS = "inline-flex min-h-12 w-full items-center justify-center bg-brand-700 px-6 text-base font-[530] text-white duration-300 ease-out hover:bg-brand-900 active:bg-brand-900 print:hidden";

export default function PrintButton({ href, className = "", ...data }: { href?: string; className?: string } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <button type="button" onClick={() => { if (href) window.location.href = href; else window.print(); }} className={`${PRINT_BUTTON_CLASS} ${className}`} data-print-button {...data}>
      {PRINT_CTA}
    </button>
  );
}
