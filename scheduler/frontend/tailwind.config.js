/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Semantic booking status colors
        'booking-selected': {
          DEFAULT: '#8b5cf6', // violet-500
          dark: '#a78bfa', // violet-400
        },
        'booking-pending': {
          DEFAULT: '#f59e0b', // amber-500
          dark: '#fbbf24', // amber-400
        },
        'booking-confirmed': {
          DEFAULT: '#10b981', // emerald-500
          dark: '#34d399', // emerald-400
        },
        'booking-others': {
          DEFAULT: '#9333ea', // purple-600
          dark: '#c084fc', // purple-400
        },
        'booking-conflicting': {
          DEFAULT: '#ef4444', // red-500
          dark: '#f87171', // red-400
        },
      },
    },
  },
  plugins: [],
}












