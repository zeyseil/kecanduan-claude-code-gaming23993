/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 2px rgba(56,189,248,0.6), 0 0 20px 4px rgba(56,189,248,0.45)",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 2px rgba(56,189,248,0.5), 0 0 14px 2px rgba(56,189,248,0.35)",
          },
          "50%": {
            boxShadow: "0 0 0 2px rgba(56,189,248,0.8), 0 0 26px 6px rgba(56,189,248,0.55)",
          },
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
