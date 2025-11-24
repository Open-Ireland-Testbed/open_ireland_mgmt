/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Accent color (purple/violet theme)
        accent: {
          DEFAULT: 'hsl(270, 70%, 50%)',
          light: 'hsl(270, 70%, 60%)',
          dark: 'hsl(270, 70%, 40%)',
        },
      },
    },
  },
  plugins: [],
}

