import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Polyfills required by Radix UI / cmdk under jsdom.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = ResizeObserverPolyfill;
}

if (typeof (Element.prototype as any).scrollIntoView === "undefined") {
  (Element.prototype as any).scrollIntoView = () => {};
}

if (typeof (window as any).PointerEvent === "undefined") {
  (window as any).PointerEvent = class extends Event {};
}

if (typeof (HTMLElement.prototype as any).hasPointerCapture === "undefined") {
  (HTMLElement.prototype as any).hasPointerCapture = () => false;
  (HTMLElement.prototype as any).releasePointerCapture = () => {};
  (HTMLElement.prototype as any).setPointerCapture = () => {};
}

