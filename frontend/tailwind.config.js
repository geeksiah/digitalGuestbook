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
        primary: {
          50: '#ecfbf8',
          100: '#d1f6f0',
          200: '#a3ece1',
          300: '#76e3d3',
          400: '#49d9c6',
          500: '#1bd4bc',
          600: '#15b39f',
          700: '#108f7f',
          800: '#0b6b5f',
          900: '#074a43',
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
          900: '#1a1a2e',
          950: '#16213e',
        },
        /*
         * Neutral ramp. 50-300 are surfaces and dividers, 400-900 are text and
         * icon tones. 400 clears 3:1 (icons, control borders) and 500 upward
         * clears 4.5:1 on white, so secondary copy stays readable.
         */
        surface: {
          50: '#fbfbfc',
          100: '#f5f6f7',
          200: '#e8eaec',
          300: '#d3d8db',
          400: '#8d979d',
          500: '#6e777d',
          600: '#5b6469',
          700: '#474f54',
          800: '#333a3e',
          900: '#22272a',
        },
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-plus-jakarta)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: 'var(--sidebar-w)',
        topbar: 'var(--topbar-h)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.18s ease-out',
        'slide-down': 'slideDown 0.18s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05)',
        elegant: '0 12px 32px rgba(15, 23, 42, 0.12)',
        menu: '0 12px 32px rgba(15, 23, 42, 0.14)',
      },
    },
  },
  plugins: [],
};
