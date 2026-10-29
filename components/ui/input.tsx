import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn("h-11 w-full border-0 border-b border-black bg-transparent px-0 text-base placeholder:text-black/35 focus-visible:outline-none focus-visible:border-[#3760f2]", className)}
    {...p}
  />
));
Input.displayName = "Input";
