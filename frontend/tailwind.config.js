/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F9F7F3",
        surface: "#FFFFFF",
        muted: "#EFECE5",
        border: "#E5E1D8",
        ink: {
          DEFAULT: "#1A1C19",
          soft: "#4B5563",
          faint: "#8A8F87",
        },
        brand: {
          DEFAULT: "#2C5530",
          hover: "#214124",
          soft: "#E7EEE7",
        },
        terracotta: "#D47A57",
        ochre: "#D19C4C",
        coco: "#4A6E82",
        success: "#2F9E68",
        warning: "#C8890F",
        danger: "#D6553F",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        display: ["Manrope", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        xl: "0.85rem",
        "2xl": "1.15rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,28,25,0.04), 0 8px 24px -12px rgba(26,28,25,0.12)",
        lift: "0 10px 30px -12px rgba(26,28,25,0.22)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
