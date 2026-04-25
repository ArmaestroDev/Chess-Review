/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Chess.com-ish palette
        board: {
          light: '#eaeaea',
          dark: '#7c7ac6',
          highlight: '#f6e07a',
          arrow: '#86bf2c',
        },
        wood: {
          DEFAULT: '#3b2317',
          dark: '#241410',
          light: '#5a3823',
          panel: '#2a1a11',
        },
        review: {
          best: '#1ea05a',
          brilliant: '#1baca6',
          great: '#5b9bd5',
          good: '#86bf2c',
          ok: '#a3a3a3',
          book: '#a88a59',
          inaccuracy: '#f5b840',
          mistake: '#f08a36',
          blunder: '#d6443a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 30px 60px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};
