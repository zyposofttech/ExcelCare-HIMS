import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // ChatGPT-like typography (Söhne where available, Inter as shipped, then system).
        sans: [
          "var(--font-sans)",
          "Söhne",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
      },
      colors: {
        xc: {
          bg: "rgb(var(--xc-bg) / <alpha-value>)",
          panel: "rgb(var(--xc-panel) / <alpha-value>)",
          card: "rgb(var(--xc-card) / <alpha-value>)",
          border: "rgb(var(--xc-border) / <alpha-value>)",
          text: "rgb(var(--xc-text) / <alpha-value>)",
          muted: "rgb(var(--xc-muted) / <alpha-value>)",
          accent: "rgb(var(--xc-accent) / <alpha-value>)",
          accent2: "rgb(var(--xc-accent2) / <alpha-value>)",
          ring: "rgb(var(--xc-ring) / <alpha-value>)",
          danger: "rgb(var(--xc-danger) / <alpha-value>)",
          warn: "rgb(var(--xc-warn) / <alpha-value>)",
          ok: "rgb(var(--xc-ok) / <alpha-value>)",
        },
      },
      boxShadow: {
        "elev-1": "0 1px 2px rgb(0 0 0 / 0.12)",
        "elev-2": "0 12px 40px rgb(0 0 0 / 0.28)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
    },
  },
  plugins: [],
} satisfies Config;
