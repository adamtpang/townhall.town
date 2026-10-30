import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Ink on #f2f2f2 with the townhall purple accent, plus ndstudio.gov-style design tokens from PR #2.
// Token colors read CSS variables in app/globals.css (shadcn format). Party labels are ink only.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/typeScale.ts"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#010101", 700: "#6B2489", 900: "#000000", 50: "#f2f2f2" },
        // townhall purple (design spec Oct 30 2026). No red or blue anywhere; party labels stay ink.
        brand: { 50: "#F6EFF9", 100: "#ECDDF3", 300: "#C9A3DC", 500: "#9B4DB8", 600: "#862F9F", 700: "#6B2489", 900: "#3A1250", DEFAULT: "#862F9F" },
        ink: "#010101",
        // Neutral greys only: no blue-tinted slate on an ink-on-#f2f2f2 page.
        slate: colors.neutral,
        surface: "#f2f2f2",
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
      fontFamily: {
        sans: ["var(--font-grotesk)", "var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // No serif anywhere (#27): nothing uses font-serif, and the class still maps to the grotesk as a safety net.
        serif: ["var(--font-grotesk)", "var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Audit 3:05 PM CT (Oct 30): nothing on screen under 14px. text-xs is floored at 14/20.
        xs: ["14px", { lineHeight: "20px" }],
        // Fluid 6xl so section headings stay below the page title on phones (40px at 375px wide, 60px on desktop).
        "6xl": ["clamp(2.5rem, 8vw, 3.75rem)", { lineHeight: "1" }],
        "nds-display": ["clamp(50px, 9.375vw, 180px)", { lineHeight: "0.95", letterSpacing: "-0.02em", fontWeight: "530" }],
        "nds-h1": ["104px", { lineHeight: "0.98", letterSpacing: "-0.02em", fontWeight: "530" }],
        "nds-h2": ["60px", { lineHeight: "0.96", letterSpacing: "-0.02em", fontWeight: "450" }],
        "nds-h3": ["44px", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "450" }],
        "nds-body-lg": ["30px", { lineHeight: "1.2", fontWeight: "450" }],
        "nds-post": ["18px", { lineHeight: "1.4", fontWeight: "450" }],
        "nds-body": ["16px", { lineHeight: "1.4", fontWeight: "450" }],
        "nds-caption": ["14px", { lineHeight: "1.15", fontWeight: "530" }],
        "nds-micro": ["14px", { lineHeight: "1.15", fontWeight: "530" }],
      },
      // Inter Tight at two weights only (450 body, 530 emphasis); nothing lighter or heavier.
      fontWeight: { light: "450", normal: "450", medium: "450", semibold: "530", bold: "530", extrabold: "530", black: "530" },
      maxWidth: { site: "87rem", grid: "2160px" },
      transitionTimingFunction: { nds: "cubic-bezier(.215,.61,.355,1)", nd: "cubic-bezier(.215,.61,.355,1)" },
    },
  },
  plugins: [],
} satisfies Config;
