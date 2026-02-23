/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // ASU brand colors
        'asu-maroon': '#8C1D40',
        'asu-gold': '#FFC627',
        'asu-gray': '#747474',
        // Custom maroon variants
        'maroon-600': '#8C1D40',
        'maroon-700': '#7A1836',
      },
      fontFamily: {
        sans: [
          '-apple-system', 
          'BlinkMacSystemFont',
          '"Segoe UI"', 
          'Roboto', 
          '"Helvetica Neue"', 
          'Arial', 
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'monospace'
        ],
      },
      animation: {
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}