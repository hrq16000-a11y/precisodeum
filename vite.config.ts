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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
              return 'vendor-react';
            }
            if (
              id.includes('react-hook-form') ||
              id.includes('@hookform/resolvers') ||
              id.includes('/zod/')
            ) {
              return 'vendor-forms';
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('/cmdk/') ||
              id.includes('embla-carousel') ||
              id.includes('/sonner/') ||
              id.includes('/clsx/') ||
              id.includes('tailwind-merge')
            ) {
              return 'vendor-ui';
            }
            if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
              return 'vendor-data';
            }
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('leaflet')) return 'vendor-maps';
            if (id.includes('date-fns')) return 'vendor-dates';
            return 'vendor';
          }
        },
      },
    },
  },
}));
