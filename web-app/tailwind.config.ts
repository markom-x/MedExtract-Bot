import type { Config } from "tailwindcss";

/**
 * Tema tech / futuristico: base scura (zinc/slate-950), accent neon.
 * Usa insieme a app/globals.css (@config).
 */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /** Accent neon (allineati alle scale Tailwind) */
        neon: {
          cyan: "#22d3ee", // cyan-400
          magenta: "#d946ef", // fuchsia-500 (magenta neon)
          indigo: "#6366f1", // indigo-500
        },
      },
      backgroundImage: {
        /** indigo-500 → cyan-400 */
        "gradient-tech":
          "linear-gradient(to bottom right, #6366f1, #22d3ee)",
        /** variante con magenta */
        "gradient-tech-magenta":
          "linear-gradient(to bottom right, #6366f1, #d946ef)",
        /** cyan → magenta */
        "gradient-tech-duo":
          "linear-gradient(135deg, #22d3ee 0%, #d946ef 50%, #6366f1 100%)",
      },
      boxShadow: {
        /** Glow cyan neon */
        neon: "0 0 15px rgba(34, 211, 238, 0.3)",
        "neon-sm": "0 0 10px rgba(34, 211, 238, 0.25)",
        "neon-lg": "0 0 28px rgba(34, 211, 238, 0.35)",
        "neon-magenta": "0 0 18px rgba(217, 70, 239, 0.35)",
        "neon-indigo": "0 0 20px rgba(99, 102, 241, 0.35)",
      },
    },
  },
} satisfies Config;
