import type { Config } from "tailwindcss";

// Colours are CSS variables (src/app/globals.css) so light and dark mode share one set of names.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fog: v("fog"), // page background
        card: v("card"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        jacaranda: v("jacaranda"), // actions only
        "on-jacaranda": v("on-jacaranda"),
        dusk: v("dusk"), // "Next date" panel
        "on-dusk": v("on-dusk"),
        amber: v("amber"), // highlights, always behind dark text
        chip: v("chip"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
