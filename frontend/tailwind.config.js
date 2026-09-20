/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e3a8a",
          hover: "#1e40af",
        },
        secondary: "#0f766e",
        accent: "#7c3aed",
        surface: "#ffffff",
        muted: "#64748b",
        sos: "#dc2626",
        success: "#15803d",
        warning: "#b45309",
        danger: "#b91c1c",
        info: "#0369a1",
        border: "#e2e8f0",
        sidebar: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
          muted: "#64748b",
          accent: "#f1f5f9",
          border: "#e2e8f0",
        },
      },
      borderRadius: {
        control: "6px",
        panel: "10px",
      },
      fontFamily: {
        display: ["var(--font-display)", "Segoe UI", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
