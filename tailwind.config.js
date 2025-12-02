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
      // Override default Tailwind colors with CSS custom properties
      // This allows runtime theme switching while using standard Tailwind classes
      colors: {
        // Override primary blue colors (used throughout the app)
        blue: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
          950: 'var(--color-primary-950, #172554)',
        },
        // Override secondary purple colors
        purple: {
          50: 'var(--color-secondary-50, #faf5ff)',
          100: 'var(--color-secondary-100, #f3e8ff)',
          200: 'var(--color-secondary-200, #e9d5ff)',
          300: 'var(--color-secondary-300, #d8b4fe)',
          400: 'var(--color-secondary-400, #c084fc)',
          500: 'var(--color-secondary-500, #a855f7)',
          600: 'var(--color-secondary-600, #9333ea)',
          700: 'var(--color-secondary-700, #7e22ce)',
          800: 'var(--color-secondary-800, #6b21a8)',
          900: 'var(--color-secondary-900, #581c87)',
          950: 'var(--color-secondary-950, #3b0764)',
        },
        // Override accent green colors
        green: {
          50: 'var(--color-accent-50, #f0fdf4)',
          100: 'var(--color-accent-100, #dcfce7)',
          200: 'var(--color-accent-200, #bbf7d0)',
          300: 'var(--color-accent-300, #86efac)',
          400: 'var(--color-accent-400, #4ade80)',
          500: 'var(--color-accent-500, #22c55e)',
          600: 'var(--color-accent-600, #16a34a)',
          700: 'var(--color-accent-700, #15803d)',
          800: 'var(--color-accent-800, #166534)',
          900: 'var(--color-accent-900, #14532d)',
          950: 'var(--color-accent-950, #052e16)',
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