// Adam 9:58 AM CT Oct 30 + design spec 10:14 AM CT: anyone without a photo (or on data/photo_takedowns.json) gets ONE
// gender-neutral placeholder, the same for everyone: head circle ~36% of the tile width centred at 38% height, a
// shoulder arc clipped by the bottom edge, black/30 on #E5E5E5. The SVG is decorative (aria-hidden); screen readers
// hear "No photo found". Never inferred from a name, never a face. The tile box itself is the photo tile's box.
export const NO_PHOTO_LABEL = "No photo found";
export const PLACEHOLDER_BG = "bg-[#E5E5E5]";
export function AvatarPlaceholder({ className = "" }: { className?: string }) {
  return (
    <span className={`absolute inset-0 ${PLACEHOLDER_BG} ${className}`} data-avatar-placeholder-box>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-black/30" data-avatar-placeholder>
        <circle cx="50" cy="38" r="18" fill="currentColor" />
        <path d="M14 100C14 78 30 64 50 64S86 78 86 100Z" fill="currentColor" />
      </svg>
      <span className="sr-only">{NO_PHOTO_LABEL}</span>
    </span>
  );
}
