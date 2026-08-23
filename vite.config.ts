// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(Date.now()),
    },
    plugins: [
      // Bundle report opt-in: ANALYZE=1 bun run build → /tmp/bundle-stats.html
      process.env.ANALYZE === "1" &&
        visualizer({
          filename: "/tmp/bundle-stats.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: false,
        }),
    ].filter(Boolean),
    build: {
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
    },
  },
});
