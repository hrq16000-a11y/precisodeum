/**
 * useLocalThumbnail — gera prévia local instantânea do arquivo selecionado.
 *
 * Usa URL.createObjectURL: zero processamento, aparece em <16ms. A revogação é
 * automática (cleanup no unmount/troca de arquivo) pra não vazar memória.
 *
 * Mantém a UI responsiva enquanto compressImage e o upload acontecem em
 * background — o usuário vê a foto IMEDIATAMENTE, e só a barra de progresso
 * indica o estado do envio.
 */

import { useEffect, useRef, useState } from 'react';

export function useLocalThumbnail(file: File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Revoga URL anterior antes de criar nova (evita vazamento)
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }

    if (!file) {
      setUrl(null);
      return;
    }

    // Só cria preview pra MIME image/*
    if (!file.type?.startsWith('image/')) {
      setUrl(null);
      return;
    }

    try {
      const next = URL.createObjectURL(file);
      lastUrlRef.current = next;
      setUrl(next);
    } catch {
      setUrl(null);
    }

    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, [file]);

  return url;
}
