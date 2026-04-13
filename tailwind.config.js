/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        notebook: {
          bg: '#0d0d1a',
          surface: '#13131f',
          border: '#1e1e3a',
          tab: '#0f0f1e',
          'tab-active': '#1a1a2e',
          accent: '#4facfe',
          'accent-secondary': '#00f2fe',
          text: '#e2e8f0',
          'text-muted': '#718096',
          success: '#48bb78',
          warning: '#ed8936',
          error: '#fc8181',
          leader: '#ffd700',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 5px #4facfe40' },
          to: { boxShadow: '0 0 20px #4facfe80, 0 0 40px #4facfe40' },
        },
      },
    },
  },
  plugins: [],
};
