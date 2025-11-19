/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary brand colors (used in both light and dark mode)
          primary: '#48bb78',
          hover: '#38a169',
          
          // Dark mode backgrounds - change these to rebrand dark mode
          'dark-bg': '#343541',
          'dark-sidebar': '#343541',
          'dark-input': '#343541',
          'dark-secondary': '#343541',
          'dark-tertiary': '#343541',
          'dark-modal': '#343541',
          
          // Light mode backgrounds - change these to rebrand light mode
          'light-bg': '#ffffff',
          'light-sidebar': '#f9fafb',
          'light-input': '#f3f4f6',
          'light-secondary': '#e5e7eb',
          'light-tertiary': '#d1d5db',
          'light-modal': '#ffffff',
        },
      },
    },
  },
  variants: {
    extend: {
      visibility: ['group-hover'],
    },
  },
  plugins: [require('@tailwindcss/typography')],
};