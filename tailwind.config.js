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
        // Brand colors using CSS custom properties for runtime theme switching
        // Light theme colors
        'brand-bg-light': 'var(--color-brand-bg-light, #ffffff)',
        'brand-text-light': 'var(--color-brand-text-light, #000000)',
        'brand-primary-light': 'var(--color-brand-primary-light, #3b82f6)',
        'brand-primary-hover-light': 'var(--color-brand-primary-hover-light, #2563eb)',
        'brand-secondary-light': 'var(--color-brand-secondary-light, #8b5cf6)',
        'brand-accent-light': 'var(--color-brand-accent-light, #10b981)',
        
        // Dark theme colors
        'brand-bg-dark': 'var(--color-brand-bg-dark, #1a1a1a)',
        'brand-text-dark': 'var(--color-brand-text-dark, #ffffff)',
        'brand-primary-dark': 'var(--color-brand-primary-dark, #60a5fa)',
        'brand-primary-hover-dark': 'var(--color-brand-primary-hover-dark, #3b82f6)',
        'brand-secondary-dark': 'var(--color-brand-secondary-dark, #a78bfa)',
        'brand-accent-dark': 'var(--color-brand-accent-dark, #34d399)',
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