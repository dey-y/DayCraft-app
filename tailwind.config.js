/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      // Tokens semánticos del sistema de temas Kuro-Zen (ver constants/themes.ts).
      colors: {
        canvas: token("canvas"),
        header: token("header"),
        card: token("card"),
        raised: token("raised"),
        line: token("line"),
        "line-subtle": token("line-subtle"),
        ink: token("ink"),
        muted: token("muted"),
        accent: token("accent"),
        "accent-soft": token("accent-soft"),
        "on-accent": token("on-accent"),
        ok: token("ok"),
        warm: token("warm"),
        info: token("info"),
        now: token("now")
      },
      fontFamily: {
        sans: ["Inter", "System"],
        mono: ["monospace"]
      }
    }
  },
  plugins: []
};
