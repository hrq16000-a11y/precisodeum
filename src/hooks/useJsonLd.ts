import { useEffect, useMemo } from 'react';

/**
 * Injeta um <script type="application/ld+json"> no <head>.
 *
 * - Garante UM script por (id) — evita duplicar JSON-LD na mesma rota se o
 *   componente re-renderizar.
 * - Pode receber um `id` explícito (recomendado) para que rotas diferentes não
 *   colidam quando usam o mesmo @type (ex.: vários FAQPage no site).
 * - Usa stringify estável memoizado para não regravar o nó a cada render.
 */
export function useJsonLd(
  data: Record<string, any> | null,
  id?: string
) {
  const serialized = useMemo(() => (data ? JSON.stringify(data) : null), [data]);
  const scriptId = useMemo(
    () => id || `json-ld-${data?.['@type'] || 'default'}`,
    [id, data]
  );

  useEffect(() => {
    if (!serialized) return;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    // Só atualiza o conteúdo se mudou — barato em renders subsequentes.
    if (script.textContent !== serialized) {
      script.textContent = serialized;
    }
    return () => {
      script?.remove();
    };
  }, [serialized, scriptId]);
}
