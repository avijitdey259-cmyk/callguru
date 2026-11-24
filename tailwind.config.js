/** @type {import('tailwindcss').Config} */
// Style 6 · Pinterest Blend — minimal white feed, near-black text, Pi purple→gold
// gradient primary (UI refresh). The `fb` token names are kept (the code uses them
// everywhere) but their values are now the Pinterest Blend palette.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fb: { blue: '#7C3AED', bg: '#FFFFFF', dark: '#0F0F0F', card: '#1C1C1E', green: '#42B72A' },
        pb: { violet: '#7C3AED', pink: '#EC4899', rose: '#F43F5E', red: '#EF4444', ink: '#111827' },
        pi: { purple: '#7C3AED', gold: '#F59E0B', deep: '#D97706' }
      }
    }
  },
  plugins: []
}
