import { useEffect } from 'react';

export function useJsonLd(data: Record<string, any> | null) {
  useEffect(() => {
    if (!data) return;
    const id = 'json-ld-' + (data['@type'] || 'default');
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
    return () => { script?.remove(); };
  }, [data]);
}
