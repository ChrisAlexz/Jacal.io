/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scoped to the Tailwind-built component(s) only, so utilities never leak into
  // / reset the existing Bootstrap + custom-CSS pages.
  content: ['./src/components/TubelightNavbar.jsx'],
  // Disable Tailwind's global reset — this app is styled with custom CSS/Bootstrap.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // Brand blue accent (matches the app's #4facfe gradient / Clerk theme)
        primary: '#4facfe',
      },
    },
  },
  plugins: [],
};
