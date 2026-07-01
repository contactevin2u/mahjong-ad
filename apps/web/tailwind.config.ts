import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0b6b4f",
          dark: "#074b37",
        },
        gold: "#e8c268",
      },
    },
  },
  plugins: [],
};

export default config;
