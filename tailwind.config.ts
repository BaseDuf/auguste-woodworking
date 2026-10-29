import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        stone: {
          50:  '#F8F6F0',
          100: '#EEF3EC',
          200: '#DDE8D9',
          300: '#C8D9C4',
          400: '#9BB89A',
          500: '#6B7C6B',
          600: '#5A6B5A',
          700: '#3D533D',
          800: '#2C3E2D',
          900: '#1E2E1F',
          950: '#131F14',
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", ...defaultTheme.fontFamily.serif],
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
export default config;
