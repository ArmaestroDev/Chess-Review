/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Chess board surfaces — kept consistent across themes for readability.
        board: {
          light: '#ebd8b7',
          dark: '#8c6f4f',
          highlight: '#f6e07a',
          arrow: '#86bf2c',
        },
        // Surface palette — driven by CSS vars so themes can swap in one shot.
        wood: {
          DEFAULT: 'rgb(var(--wood-default) / <alpha-value>)',
          dark: 'rgb(var(--wood-dark) / <alpha-value>)',
          light: 'rgb(var(--wood-light) / <alpha-value>)',
          panel: 'rgb(var(--wood-panel) / <alpha-value>)',
          card: 'rgb(var(--wood-card) / <alpha-value>)',
          hover: 'rgb(var(--wood-hover) / <alpha-value>)',
        },
        // Foreground (text) ramp.
        ink: {
          DEFAULT: 'rgb(var(--ink-default) / <alpha-value>)',
          2: 'rgb(var(--ink-2) / <alpha-value>)',
          3: 'rgb(var(--ink-3) / <alpha-value>)',
          4: 'rgb(var(--ink-4) / <alpha-value>)',
          5: 'rgb(var(--ink-5) / <alpha-value>)',
        },
        // Hairlines — themeable to keep contrast on each theme's surfaces.
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
        },
        // Move classifications — fixed colors (chess UX).
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
        // Brand accent — themed.
        accent: {
          DEFAULT: 'rgb(var(--accent-default) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
          soft: 'var(--accent-soft)',
          softer: 'var(--accent-softer)',
        },
        // Eval semantic colors (kept fixed).
        pos: '#86bf2c',
        neg: '#d6443a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(245, 232, 200, 0.04)',
        'card-md': '0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.18), 0 0 0 0.5px rgba(245, 232, 200, 0.05)',
        panel: '0 30px 60px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        board: '0 1px 0 rgba(255, 220, 150, 0.06) inset, 0 8px 30px rgba(0, 0, 0, 0.55), 0 0 0 0.5px rgba(245, 232, 200, 0.10)',
        'inset-card': 'inset 0 1px 0 rgba(255, 220, 150, 0.06)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
