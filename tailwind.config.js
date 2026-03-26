/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.ts",
    "./controllers/**/*.{js,ts,jsx,tsx}",
    "./middlewares/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./repository/**/*.{js,ts,jsx,tsx}",
    "./**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

