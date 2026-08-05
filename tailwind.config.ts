import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'Palatino Linotype',
          'Palatino',
          'Book Antiqua',
          'Times New Roman',
          'Georgia',
          'serif',
        ],
        display: [
          'Palatino Linotype',
          'Palatino',
          'Book Antiqua',
          'Georgia',
          'serif',
        ],
      },
      colors: {
        parchment: {
          50: '#fcf7f4',
          100: '#f7ebe4',
          200: '#f4e3da',
          300: '#e8cfc0',
          400: '#d4b09a',
        },
        ink: {
          DEFAULT: '#3d2f2a',
          light: '#6b5650',
          muted: '#9a8580',
        },
      },
      boxShadow: {
        card: '0 8px 32px rgba(61, 47, 42, 0.08)',
        'card-hover': '0 16px 48px rgba(61, 47, 42, 0.14)',
      },
    },
  },
  plugins: [],
};

export default config;
