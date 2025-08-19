/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'trading-green': '#10b981',
        'trading-red': '#ef4444',
        'trading-bg': '#0f1419',
        'trading-surface': '#1a2332',
        'trading-border': '#2d3748',
      },
      animation: {
        'pulse-green': 'pulse-green 1s ease-in-out',
        'pulse-red': 'pulse-red 1s ease-in-out',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
        },
        'pulse-red': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
        },
      },
    },
  },
  plugins: [],
}