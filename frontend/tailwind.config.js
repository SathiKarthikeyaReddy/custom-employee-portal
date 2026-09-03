/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#12151C',
        paper: '#F3F4F1',
        forest: '#2F6F4F',
        amber: '#C98A2C',
        'ink-text': '#1B1E27',
        border: '#DEDDD6',
        role: {
          admin: '#1B1E27',
          hr: '#3B5BA9',
          sales: '#C98A2C',
          support: '#2F8F8F',
          finance: '#2F6F4F',
          manager: '#6B5B95',
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
