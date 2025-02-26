/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "dark"
  ],
  theme: {
    fontSize: {
      default: '0.75rem',   // 12px
      xss: '0.5625rem',     // 9px
      xs: '0.625rem',       // 10px
      base: '0.75rem',      // 12px
      sm: '0.875rem',       // 14px
      lg: '1.125rem',       // 18px
      xl: '1.625rem',       // 26px
      '2xl': '2.2rem',        // 32px
      '3xl': '3rem',        // 48px
      '4xl': '3.5rem',      // 56px
      '5xl': '4.25rem',     // 68px
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        "2px": '2px',
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 6px)",
      },
      rotate: {
        '270': '270deg',
      },
    }
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addBase }) {
      addBase({
        'html, body': { fontSize: '13px' },
      })
    },
    function ({ addVariant }) {
      addVariant('parent', ':merge(.parent) &');
    },
  ],
}
