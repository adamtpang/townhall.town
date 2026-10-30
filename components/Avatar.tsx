// Adam 9:58 AM CT Oct 30 (as relayed): anyone without a photo, or on data/photo_takedowns.json, gets ONE placeholder
// avatar: a plain, gender-neutral person silhouette, the same square as a photo. Never inferred from a name, never a face.
export const NO_PHOTO_LABEL = "No photo available";
export function AvatarPlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg role="img" aria-label={NO_PHOTO_LABEL} viewBox="0 0 64 64" preserveAspectRatio="xMidYMax meet" className={`absolute inset-0 h-full w-full text-black/25 ${className}`} data-avatar-placeholder>
      <circle cx="32" cy="24" r="11" fill="currentColor" />
      <path d="M10 64c0-13 10-22 22-22s22 9 22 22z" fill="currentColor" />
    </svg>
  );
}
