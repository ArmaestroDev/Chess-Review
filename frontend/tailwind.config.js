/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Chess board surfaces
        board: {
          light: '#ebecd0',
          dark: '#7c7ac6',
          highlight: '#f6e07a',
          arrow: '#86bf2c',
        },
        // Wood / panel surface palette (dark theme).
        wood: {
          DEFAULT: '#3b2317',
          dark: '#241410',
          light: '#5a3823',
          panel: '#2a1a11',
          card: '#33201a',
          hover: '#3d2620',
        },
        // Foreground (text) ramp on the dark wood.
        ink: {
          DEFAULT: '#f4ecd8',
          2: '#e6dbc1',
          3: '#b8a988',
          4: '#8a7d62',
          5: '#5e5443',
        },
        // Hairlines and borders.
        line: {
          DEFAULT: 'rgba(245, 232, 200, 0.10)',
          2: 'rgba(245, 232, 200, 0.18)',
        },
        // Move classification colors (also used by EvalChart, badges, etc.).
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
        // Brand accent — warm gold/amber.
        accent: {
          DEFAULT: '#d8b56a',
          ink: '#f5cf7a',
          soft: 'rgba(216, 181, 106, 0.16)',
          softer: 'rgba(216, 181, 106, 0.08)',
        },
        // Semantic eval colors for the bar / chart.
        pos: '#86bf2c',
        neg: '#d6443a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(245, 232, 200, 0.04)',
        'card-md': '0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.18), 0 0 0 0.5px rgba(245, 232, 200, 0.05)',
        'panel': '0 30px 60px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        'board': '0 1px 0 rgba(255, 220, 150, 0.06) inset, 0 8px 30px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(245, 232, 200, 0.10)',
        'inset-card': 'inset 0 1px 0 rgba(255, 220, 150, 0.06)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
