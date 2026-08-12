import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// Plugin de instrumentação: imprime marcos e duração de cada etapa do build.
function buildTimingPlugin() {
  const t0 = Date.now();
  let modules = 0;
  const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const log = (msg: string) => console.log(`[build:timing +${since()}] ${msg}`);
  return {
    name: "build-timing",
    apply: "build" as const,
    buildStart() {
      log("buildStart — iniciando resolução de módulos");
    },
    moduleParsed() {
      modules += 1;
      if (modules % 500 === 0) log(`${modules} módulos processados`);
    },
    buildEnd(err?: Error) {
      log(err ? `buildEnd com erro: ${err.message}` : `buildEnd — ${modules} módulos`);
    },
    renderStart() {
      log("renderStart — gerando e minificando chunks");
    },
    generateBundle(_opts: unknown, bundle: Record<string, unknown>) {
      log(`generateBundle — ${Object.keys(bundle).length} arquivos`);
    },
    writeBundle() {
      log("writeBundle — arquivos escritos em disco");
    },
    closeBundle() {
      log("closeBundle — build finalizado");
    },
  };
}


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
    // Log verboso por etapa: mostra exatamente onde o build de produção gasta
    // (ou trava) tempo — útil quando o deploy estoura o limite.
    mode === "production" && buildTimingPlugin(),
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
