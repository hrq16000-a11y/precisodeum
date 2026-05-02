import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // ── Bet Mode tokens (âmbar → laranja → verde) ──
        // Fonte única para Wizard e Dashboard. Use SEMPRE estes tokens
        // (bg-bet-amber, text-bet-orange-fg, ring-bet-orange, etc.)
        // em vez de classes Tailwind cruas como bg-amber-500 ou bg-blue-500.
        bet: {
          amber: {
            DEFAULT: "hsl(var(--bet-amber))",
            hover: "hsl(var(--bet-amber-hover))",
            active: "hsl(var(--bet-amber-active))",
            soft: "hsl(var(--bet-amber-soft))",
            border: "hsl(var(--bet-amber-border))",
            fg: "hsl(var(--bet-amber-fg))",
          },
          orange: {
            DEFAULT: "hsl(var(--bet-orange))",
            hover: "hsl(var(--bet-orange-hover))",
            active: "hsl(var(--bet-orange-active))",
            soft: "hsl(var(--bet-orange-soft))",
            border: "hsl(var(--bet-orange-border))",
            fg: "hsl(var(--bet-orange-fg))",
          },
          green: {
            DEFAULT: "hsl(var(--bet-green))",
            hover: "hsl(var(--bet-green-hover))",
            active: "hsl(var(--bet-green-active))",
            soft: "hsl(var(--bet-green-soft))",
            border: "hsl(var(--bet-green-border))",
            fg: "hsl(var(--bet-green-fg))",
          },
          error: {
            DEFAULT: "hsl(var(--bet-error))",
            soft: "hsl(var(--bet-error-soft))",
            border: "hsl(var(--bet-error-border))",
          },
          disabled: {
            bg: "hsl(var(--bet-disabled-bg))",
            fg: "hsl(var(--bet-disabled-fg))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // ── Escala única de z-index (Fonte da verdade) ──
      // Use sempre estes tokens em vez de números avulsos para evitar
      // conflitos entre Select / Popover / Tooltip / Modais.
      //   base       — conteúdo padrão
      //   dropdown   — Select / Combobox / Dropdown menu
      //   sticky     — headers/abas grudentos
      //   bottomNav  — navegação inferior mobile
      //   overlay    — backdrop de modais
      //   modal      — Dialog / Sheet
      //   popover    — Popover (acima de Modal quando aberto dentro)
      //   tooltip    — Tooltip (sempre no topo da pilha interativa)
      //   toast      — Notificações transitórias
      //   max        — Reservado para banners de impersonation/alertas críticos
      zIndex: {
        base: "1",
        dropdown: "40",
        sticky: "45",
        bottomNav: "50",
        overlay: "55",
        modal: "60",
        popover: "65",
        tooltip: "70",
        toast: "80",
        max: "90",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.95) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "scale(0.8)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "wizard-shimmer": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "online-pulse": {
          "0%": { transform: "scale(0.85)", opacity: "0.55" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "online-breath": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.12)", opacity: "0.92" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-scale": "fade-in-scale 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
        "slide-in-left": "slide-in-left 0.4s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "count-up": "count-up 0.3s ease-out forwards",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "online-pulse": "online-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "online-breath": "online-breath 2.4s ease-in-out infinite",
      },
    },
  },
        "online-pulse": "online-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "online-breath": "online-breath 2.4s ease-in-out infinite",
        "wizard-shimmer": "wizard-shimmer 240ms ease-out 1",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
