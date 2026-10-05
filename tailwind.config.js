import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Microsoft JhengHei"',
          'sans-serif',
        ],
      },
      fontSize: {
        // Only for keycaps and dense diagram legends; UI text starts at text-xs (12px).
        '2xs': ['11px', { lineHeight: '16px' }],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-up': 'sheet-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 150ms ease-out',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      // Touch-first devices: larger hit targets, no keyboard hints.
      addVariant('coarse', '@media (pointer: coarse)');
      addVariant('fine', '@media (pointer: fine)');
      addVariant('can-hover', '@media (hover: hover)');
    }),
  ],
};
