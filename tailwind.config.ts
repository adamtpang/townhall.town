import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Official navy/white palette (existing UI) plus ndstudio.gov-style design tokens from PR #2.
// Token colors read CSS variables in app/globals.css (shadcn format). Flag red/blue are accents only, never party colors.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/typeScale.ts"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#010101", 700: "#3760f2", 900: "#000000", 50: "#f2f2f2" },
        flagred: "#b50909",
        flagblue: "#005ea2",
        flag: { red: "#d80007", blue: "#002664" },
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
        // ndstudio.gov uses one grotesk for everything. font-serif is kept as a class name but renders the grotesk.
        serif: ["var(--font-grotesk)", "var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid 6xl so section headings stay below the page title on phones (40px at 375px wide, 60px on desktop).
        "6xl": ["clamp(2.5rem, 8vw, 3.75rem)", { lineHeight: "1" }],
        "nds-display": ["clamp(50px, 9.375vw, 180px)", { lineHeight: "0.95", letterSpacing: "-0.02em", fontWeight: "700" }],
        "nds-h1": ["104px", { lineHeight: "0.98", letterSpacing: "-0.02em", fontWeight: "530" }],
        "nds-h2": ["60px", { lineHeight: "0.96", letterSpacing: "-0.02em", fontWeight: "450" }],
        "nds-h3": ["44px", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "450" }],
        "nds-body-lg": ["30px", { lineHeight: "1.2", fontWeight: "450" }],
        "nds-post": ["18px", { lineHeight: "1.4", fontWeight: "450" }],
        "nds-body": ["16px", { lineHeight: "1.4", fontWeight: "450" }],
        "nds-caption": ["14px", { lineHeight: "1.15", fontWeight: "530" }],
        "nds-micro": ["12px", { lineHeight: "1.15", fontWeight: "530" }],
      },
      // ndstudio.gov sets text at a book weight (450) with 530 as the only emphasis; nothing heavier.
      fontWeight: { normal: "450", medium: "450", semibold: "530", bold: "530", extrabold: "530", black: "530" },
      maxWidth: { site: "87rem", grid: "2160px" },
      transitionTimingFunction: { nds: "cubic-bezier(.215,.61,.355,1)" },
    },
  },
  plugins: [],
} satisfies Config;
