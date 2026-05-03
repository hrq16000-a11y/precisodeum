import DOMPurify from "dompurify";
import { useMemo } from "react";

interface SafeHTMLProps {
  html: string;
  className?: string;
  /** Permite iframes básicos (vídeos institucionais). Default: true */
  allowIframes?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Renderiza HTML sanitizado via DOMPurify.
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
  const clean = useMemo(() => {
    if (!html) return "";

    const config: Parameters<typeof DOMPurify.sanitize>[1] & {
      ADD_TAGS?: string[];
      ADD_ATTR?: string[];
    } = {
      FORBID_TAGS: ["script", "style", "object", "embed", "base", "form"],
      // Bloqueio rigoroso de event handlers in-line.
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

    return DOMPurify.sanitize(html, config) as unknown as string;
  }, [html, allowIframes]);

  return (
    <Tag
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default SafeHTML;
