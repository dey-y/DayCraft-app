/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        daycraft: {
          bg: "#0d1117",
          header: "#12151d",
          card: "#161922",
          accent: "#1f2430",
          border: "#2d3345",
          borderSubtle: "#262b3a",
          muted: "#8b949e",
          text: "#e6edf3"
        }
      },
      fontFamily: {
        sans: ["Inter", "System"],
        mono: ["monospace"]
      }
    }
  },
  plugins: []
};
