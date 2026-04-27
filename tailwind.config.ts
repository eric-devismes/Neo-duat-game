import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ef",
          100: "#e6e0d4",
          500: "#7a6a4f",
          600: "#5f5240",
          700: "#463c2f",
          900: "#221c14",
        },
      },
    },
  },
  plugins: [],
};

export default config;
