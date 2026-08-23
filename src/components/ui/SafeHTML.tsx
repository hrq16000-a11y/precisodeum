import { useEffect, useState, createElement, type JSX } from "react";

interface SafeHTMLProps {
  html: string;
  className?: string;
  /** Permite iframes básicos (vídeos institucionais). Default: true */
  allowIframes?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

// Cache do módulo: DOMPurify só entra no bundle quando SafeHTML é renderizado.
let purifyPromise: Promise<typeof import("dompurify").default> | null = null;
const loadPurify = () => {
  if (!purifyPromise) {
    purifyPromise = import("dompurify").then((m) => m.default);
  }
  return purifyPromise;
};

/**
 * Renderiza HTML sanitizado via DOMPurify (carregado dinamicamente).
 * - Bloqueia <script> e qualquer manipulador de evento in-line (onload, onerror, onclick, ...).
 * - Por padrão permite <iframe> com src/allow/allowfullscreen/frameborder/width/height
 *   (útil para YouTube/Vimeo institucionais).
 */
export function SafeHTML({
  html,
  className,
  allowIframes = true,
  as: Tag = "div",
}: SafeHTMLProps) {
  const [clean, setClean] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!html) {
      setClean("");
      return;
    }

    loadPurify().then((DOMPurify) => {
      if (cancelled) return;

      const config: Parameters<typeof DOMPurify.sanitize>[1] & {
        ADD_TAGS?: string[];
        ADD_ATTR?: string[];
      } = {
        FORBID_TAGS: ["script", "style", "object", "embed", "base", "form"],
        FORBID_ATTR: [
          "onload",
          "onerror",
          "onclick",
          "onmouseover",
          "onmouseout",
          "onfocus",
          "onblur",
          "onchange",
          "onsubmit",
          "onkeydown",
          "onkeyup",
          "onkeypress",
          "onabort",
          "onunload",
          "onbeforeunload",
          "onanimationstart",
          "onanimationend",
          "ontransitionend",
        ],
        ALLOW_DATA_ATTR: false,
      };

      if (allowIframes) {
        config.ADD_TAGS = ["iframe"];
        config.ADD_ATTR = [
          "allow",
          "allowfullscreen",
          "frameborder",
          "scrolling",
          "src",
          "width",
          "height",
          "title",
          "loading",
          "referrerpolicy",
        ];
      }

      setClean(DOMPurify.sanitize(html, config) as unknown as string);
    });

    return () => {
      cancelled = true;
    };
  }, [html, allowIframes]);

  return createElement(Tag, {
    className,
    dangerouslySetInnerHTML: { __html: clean },
  });
}

export default SafeHTML;
