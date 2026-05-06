import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        up: {
          DEFAULT: "#16a34a",
          soft: "#dcfce7",
          dark: "#22c55e"
        },
        down: {
          DEFAULT: "#dc2626",
          soft: "#fee2e2",
          dark: "#ef4444"
        },
        neutral: {
          soft: "#e5e7eb"
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Meiryo",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
