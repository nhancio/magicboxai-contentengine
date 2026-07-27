import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Open Sans", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Open Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Open Sans", "system-ui", "sans-serif"],
      },
      colors: {
        border: rgb("--border"),
        input: rgb("--input"),
        ring: rgb("--ring"),
        background: rgb("--background"),
        foreground: rgb("--foreground"),
        primary: { DEFAULT: rgb("--primary"), foreground: rgb("--primary-foreground") },
        secondary: { DEFAULT: rgb("--secondary"), foreground: rgb("--secondary-foreground") },
        muted: { DEFAULT: rgb("--muted"), foreground: rgb("--muted-foreground") },
        accent: { DEFAULT: rgb("--accent"), foreground: rgb("--accent-foreground") },
        destructive: { DEFAULT: rgb("--destructive"), foreground: rgb("--destructive-foreground") },
        card: { DEFAULT: rgb("--card"), foreground: rgb("--card-foreground") },
        popover: { DEFAULT: rgb("--popover"), foreground: rgb("--popover-foreground") },
        // brand keeps its purple scale (existing brand-600 etc. still resolve) plus DEFAULT/foreground
        brand: {
          DEFAULT: rgb("--brand"),
          foreground: rgb("--brand-foreground"),
          50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe",
          400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce",
          800: "#6b21a8", 900: "#581c87",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
      keyframes: {
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-20px)" } },
        "pulse-glow": { "0%, 100%": { opacity: "0.4" }, "50%": { opacity: "0.8" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
