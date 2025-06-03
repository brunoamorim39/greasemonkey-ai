import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "rgb(8 8 12)",
        foreground: "rgb(248 250 252)",
        border: "rgb(39 39 42)",
        input: "rgb(39 39 42)",
        ring: "rgb(249 115 22)",
        primary: {
          DEFAULT: "rgb(249 115 22)",
          foreground: "rgb(255 255 255)",
        },
        secondary: {
          DEFAULT: "rgb(39 39 42)",
          foreground: "rgb(248 250 252)",
        },
        accent: {
          DEFAULT: "rgb(251 146 60)",
          foreground: "rgb(0 0 0)",
        },
        muted: {
          DEFAULT: "rgb(39 39 42)",
          foreground: "rgb(161 161 170)",
        },
        card: {
          DEFAULT: "rgb(15 15 19)",
          foreground: "rgb(248 250 252)",
        },
        orange: {
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        red: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        green: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
        blue: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        yellow: {
          400: "#facc15",
          500: "#eab308",
        },
        purple: {
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
        },
        zinc: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
        amber: {
          200: "#fde68a",
          300: "#fcd34d",
          500: "#f59e0b",
          700: "#b45309",
          900: "#78350f",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
        "pulse-ring": "pulse-ring 2s infinite",
        "slide-in-from-bottom": "slideInFromBottom 0.5s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(249, 115, 22, 0.3)"
          },
          "50%": {
            boxShadow: "0 0 30px rgba(249, 115, 22, 0.5)"
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": {
            transform: "scale(0.8)",
            opacity: "1",
          },
          "100%": {
            transform: "scale(2.4)",
            opacity: "0",
          },
        },
        slideInFromBottom: {
          from: {
            transform: "translateY(8px)",
            opacity: "0",
          },
          to: {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      boxShadow: {
        'glow': '0 0 40px rgba(249, 115, 22, 0.3)',
        'glow-lg': '0 0 60px rgba(249, 115, 22, 0.4)',
        '3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} satisfies Config;
