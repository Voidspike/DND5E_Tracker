/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dnd: {
          bg: '#1a1a2e',
          surface: '#16213e',
          primary: '#e94560',
          accent: '#0f3460',
          text: '#eaeaea',
          muted: '#8899aa',
          success: '#2ecc71',
          warning: '#f39c12',
          danger: '#e74c3c',
        },
      },
    },
  },
  plugins: [],
};
