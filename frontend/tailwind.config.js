/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f5',
          100: '#d6ebe7',
          200: '#add8cf',
          300: '#84c4b7',
          400: '#5bb09f',
          500: '#339c87',
          600: '#1c806e',
          700: '#0f6458',
          800: '#0a4d45',
          900: '#063932',
          950: '#042924',
        },
        // Premium color palette
        primary: {
          50: '#fdf9f3',
          100: '#f9f0e1',
          200: '#f2dfc3',
          300: '#e9c89c',
          400: '#deab6f',
          500: '#d4af37', // Gold accent
          600: '#c49a2f',
          700: '#a37d28',
          800: '#856428',
          900: '#6d5224',
        },
        navy: {
          50: '#f4f6f9',
          100: '#e8ecf2',
          200: '#c5d0e0',
          300: '#9fb0cb',
          400: '#7389b0',
          500: '#536a96',
          600: '#3f527c',
          700: '#344265',
          800: '#2d3a54',
          900: '#1a1a2e', // Primary dark
          950: '#16213e',
        },
        surface: {
          50: '#fefefe',
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#636e72',
          800: '#495057',
          900: '#343a40',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'elegant': '0 25px 50px -12px rgba(26, 26, 46, 0.25)',
      },
    },
  },
  plugins: [],
};
