/**
 * Lightweight HTML sanitizer using the browser's DOMParser.
 * Removes dangerous tags (script, iframe, object, etc.) and
 * event-handler attributes (onclick, onerror, etc.) to prevent XSS.
 *
 * Drop-in replacement for DOMPurify.sanitize() when the library is
 * not available. For a production app with rich user-generated content,
 * consider replacing this with DOMPurify once a package manager is set up.
 */

const FORBIDDEN_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'select', 'textarea', 'link', 'meta', 'base', 'style',
]);

const FORBIDDEN_ATTR_PATTERN = /^on/i; // onclick, onerror, onload, etc.

const FORBIDDEN_ATTR_VALUES = /^\s*(javascript|data\s*:)/i;

function sanitizeNode(node: Element): void {
  // Remove forbidden tags (replace with their text content)
  const allElements = Array.from(node.querySelectorAll('*'));
  for (const el of allElements) {
    if (FORBIDDEN_TAGS.has(el.tagName.toLowerCase())) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
      continue;
    }
    // Remove dangerous attributes
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (
        FORBIDDEN_ATTR_PATTERN.test(attr.name) ||
        FORBIDDEN_ATTR_VALUES.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}
