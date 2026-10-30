// Towny mark (Adam picked option C, ballot box smile, 1:19 PM CT Oct 30). This is the only place the mark lives:
// swap the SVG body here to change it everywhere (floating button and panel header).
// Design spec (towny-c.svg): viewBox 64, currentColor draws the box; --k (set to the surface behind it) cuts the slot, eyes and smile.
export function TownyMark({ size = 36, label, className }: { size?: number; label?: string; className?: string }) {
  const face = "var(--k, #F2F2F2)";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} fill="none" className={className} data-towny-mark="c"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: "false" })}>
      <rect x="12" y="4" width="26" height="22" fill="currentColor" transform="rotate(-8 25 15)" />
      <rect x="6" y="24" width="52" height="36" fill="currentColor" />
      <path d="M18 30 H46" stroke={face} strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="42" r="3.5" fill={face} />
      <circle cx="40" cy="42" r="3.5" fill={face} />
      <path d="M24 50 Q32 56 40 50" stroke={face} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export default TownyMark;
