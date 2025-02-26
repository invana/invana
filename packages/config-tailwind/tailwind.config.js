/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "dark"
  ],
  theme: {
    fontSize: {
      default: '0.75rem',  // 12px
      xss: '0.625rem',   // 10px
      xs: '0.6875rem',   // 11px
      base: '0.75rem',  // 12px
      sm: '0.875rem',     // 14px
      lg: '1rem',         // 16px
      xl: '1.125rem',     // 18px
      '2xl': '1.75rem',  // 22px
      '3xl': '1.925rem',  // 26px
      '4xl': '2.6rem',      // 32px
      '5xl': '3.5rem',    // 40px
      '6xl': '4rem',      // 48px
      '7xl': '6rem',   // 60px
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
        // '135': '135deg',
        // Add any other custom rotation values here
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
