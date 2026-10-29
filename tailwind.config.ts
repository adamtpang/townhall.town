import type { Config } from "tailwindcss";

// Design system modeled on ndstudio.gov. Every color reads a CSS variable from
// app/globals.css (shadcn format), so the whole system changes from one place.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
      },
      fontSize: {
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
      colors: {
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
        ink: "#010101",
        surface: "#f2f2f2",
        navy: { 900: "#000c1f", 700: "#002664" },
        flag: { red: "#d80007", blue: "#002664" },
      },
      borderRadius: { lg: "var(--radius)", md: "var(--radius)", sm: "0px" },
      maxWidth: { prose: "60ch", site: "87rem", grid: "2160px" },
      transitionTimingFunction: { nds: "cubic-bezier(.215,.61,.355,1)" },
    },
  },
  plugins: [],
} satisfies Config;
