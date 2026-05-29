import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "scheduler"],
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "scheduler"],
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        passes: 2,
      },
      mangle: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('react-dom') ||
              id.includes('/scheduler/') ||
              id.includes('react-router')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('react-hook-form') ||
              id.includes('@hookform/resolvers') ||
              id.includes('/zod/')
            ) {
              return 'vendor-forms';
            }
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (
              id.includes('/cmdk/') ||
              id.includes('/sonner/') ||
              id.includes('/clsx/') ||
              id.includes('tailwind-merge') ||
              id.includes('class-variance-authority') ||
              id.includes('tailwindcss-animate') ||
              id.includes('/vaul/') ||
              id.includes('embla-carousel') ||
              id.includes('react-day-picker') ||
              id.includes('react-resizable-panels') ||
              id.includes('input-otp')
            ) {
              return 'vendor-ui';
            }
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
              return 'vendor-data';
            }
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('leaflet')) return 'vendor-maps';
            if (id.includes('date-fns')) return 'vendor-dates';
            if (id.includes('dompurify')) return 'vendor-sanitize';
            if (id.includes('react-helmet-async')) return 'vendor-helmet';
            if (id.includes('@fingerprintjs')) return 'vendor-fp';
            // jspdf / jspdf-autotable / canvas-confetti / jszip / sharp are
            // loaded via dynamic import() in app code and will be split
            // automatically by Rollup — do not force them into vendor.
            return 'vendor';
          }
        },
      },
    },
  },
}));
