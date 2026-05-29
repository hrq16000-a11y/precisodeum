import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

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
    mode === "production" && process.env.ANALYZE === "1" && visualizer({
      filename: "/tmp/bundle-stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: false,
    }),
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
            // Dynamic-only packages: return undefined so Rollup keeps them
            // inside the on-demand chunk created by their dynamic import().
            // Bundling them in any vendor-* chunk would pull ~1MB of jspdf
            // graph (html2canvas, pako, canvg, core-js, fflate, fast-png,
            // iobuffer, jspdf-autotable, jszip, canvas-confetti) into the
            // initial page load.
            if (
              id.includes('/jspdf/') ||
              id.includes('jspdf-autotable') ||
              id.includes('html2canvas') ||
              id.includes('/pako/') ||
              id.includes('/canvg/') ||
              id.includes('/core-js/') ||
              id.includes('/fflate/') ||
              id.includes('fast-png') ||
              id.includes('/iobuffer/') ||
              id.includes('/jszip/') ||
              id.includes('canvas-confetti')
            ) {
              return undefined;
            }

            if (
              id.includes('/react/') ||
              id.includes('react-dom') ||
              id.includes('/scheduler/') ||
              id.includes('react-router') ||
              id.includes('@remix-run/router')
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
            if (id.includes('@radix-ui') || id.includes('@floating-ui')) return 'vendor-radix';
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
            if (id.includes('@supabase') || id.includes('@tanstack/')) {
              return 'vendor-data';
            }
            if (
              id.includes('framer-motion') ||
              id.includes('motion-dom') ||
              id.includes('motion-utils')
            ) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (
              id.includes('recharts') ||
              id.includes('/d3-') ||
              id.includes('/lodash') ||
              id.includes('react-smooth') ||
              id.includes('decimal.js-light') ||
              id.includes('fast-equals') ||
              id.includes('victory-vendor')
            ) {
              return 'vendor-charts';
            }
            if (id.includes('leaflet')) return 'vendor-maps';
            if (id.includes('date-fns')) return 'vendor-dates';
            if (id.includes('dompurify')) return 'vendor-sanitize';
            if (id.includes('react-helmet-async')) return 'vendor-helmet';
            if (id.includes('@fingerprintjs')) return 'vendor-fp';
            return 'vendor';
          }
        },
      },
    },
  },
}));
