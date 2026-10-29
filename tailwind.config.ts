import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { navy: { DEFAULT: "#162e51", 700: "#1a4480", 50: "#eef2f7" }, flagred: "#b50909", flagblue: "#005ea2" },
      fontFamily: { sans: ["var(--font-public-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
