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
    // Estabilidade > micro-otimização: o particionamento manual criou um ciclo
    // entre chunks de vendor no build publicado, quebrando o namespace do React
    // antes do bootstrap (`Cannot read properties of undefined (reading
    // 'useLayoutEffect')`). Deixamos o Rollup decidir automaticamente para evitar
    // ciclos de inicialização entre dependências compartilhadas.
  },
}));
