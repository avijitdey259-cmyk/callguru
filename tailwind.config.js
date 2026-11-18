/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fb: { blue: '#1877F2', bg: '#F0F2F5', dark: '#18191A', card: '#242526', green: '#42B72A' }
      }
    }
  },
  plugins: []
}
