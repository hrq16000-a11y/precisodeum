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
  esbuild: {
    // Substitui o drop_console do terser sem custo de CPU extra.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  logLevel: "info",
  build: {
    // esbuild minifica ~10-20x mais rápido que terser (que rodava com passes:2
    // e estourava o limite de tempo do build de produção). Ganho de tamanho do
    // terser era marginal frente ao risco de timeout no deploy.
    minify: 'esbuild',
    // Sourcemaps de produção dobravam o tempo de emissão e o I/O do deploy.
    sourcemap: false,
    // Evita recomprimir (gzip) cada chunk só para o relatório do terminal.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    // Estabilidade > micro-otimização: o particionamento manual criou um ciclo
    // entre chunks de vendor no build publicado, quebrando o namespace do React
    // antes do bootstrap (`Cannot read properties of undefined (reading
    // 'useLayoutEffect')`). Deixamos o Rollup decidir automaticamente para evitar
    // ciclos de inicialização entre dependências compartilhadas.
  },
}));
