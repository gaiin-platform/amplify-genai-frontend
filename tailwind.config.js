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
          // Customize these colors for your brand
          primary: '#48bb78',
          hover: '#38a169',
          
          // All dark mode backgrounds - change this one color to rebrand
          'dark-bg': '#343541',
          'dark-sidebar': '#343541',
          'dark-input': '#343541',
          'dark-secondary': '#343541',
          'dark-tertiary': '#343541',
          'dark-modal': '#343541',
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