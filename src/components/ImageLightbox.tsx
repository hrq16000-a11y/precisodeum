import { useState, useCallback, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { portfolioFull, isVideoUrl } from '@/lib/imageOptimizer';
import { handleImageError } from '@/lib/imageResolver';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

/* ── Lightbox Image ── */
const LightboxImage = ({ url, idx, opacity, scale, translate, onError }: {
  url: string; idx: number; opacity: number;
  scale: number; translate: { x: number; y: number };
  onError: React.ReactEventHandler<HTMLImageElement>;
}) => (
  <img
    src={portfolioFull(url)}
    alt={`Imagem ${idx + 1}`}
    className="max-h-[90vh] max-w-[95vw] select-none rounded-lg object-contain"
    draggable={false}
    onError={onError}
    style={{
      transition: 'opacity 150ms ease, transform 100ms ease',
      opacity,
      transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
    }}
  />
);

/* ── Lightbox Video ── */
const LightboxVideo = ({ url, opacity }: { url: string; opacity: number }) => (
  <video
    src={url}
    controls
    autoPlay
    playsInline
    className="max-h-[90vh] max-w-[95vw] select-none rounded-lg"
    style={{ transition: 'opacity 150ms ease', opacity }}
  />
);

const ImageLightbox = ({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) => {
  const [current, setCurrent] = useState(initialIndex);
  const [opacity, setOpacity] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // Pinch-to-zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setCurrent(initialIndex);
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, initialIndex]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const changeTo = useCallback((next: number) => {
    setOpacity(0);
    setTimeout(() => {
      setCurrent(next);
      resetZoom();
      setOpacity(1);
    }, 120);
  }, [resetZoom]);

  const goNext = useCallback(() => changeTo((current + 1) % images.length), [current, images.length, changeTo]);
  const goPrev = useCallback(() => changeTo((current - 1 + images.length) % images.length), [current, images.length, changeTo]);

  const flashControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    flashControls();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartScale.current = scale;
      lastPinchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
      swiping.current = false;
      if (scale > 1) {
        panStart.current = { x: t.clientX, y: t.clientY, tx: translate.x, ty: translate.y };
      }
    }
  }, [scale, translate, flashControls]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(5, Math.max(1, pinchStartScale.current * (dist / pinchStartDist.current)));
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
      e.preventDefault();
      return;
    }
    if (e.touches.length === 1 && scale > 1 && panStart.current) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setTranslate({ x: panStart.current.tx + dx, y: panStart.current.ty + dy });
      swiping.current = true;
      return;
    }
    if (!touchStart.current || scale > 1) return;
    const dxAbs = Math.abs(e.touches[0].clientX - touchStart.current.x);
    const dyAbs = Math.abs(e.touches[0].clientY - touchStart.current.y);
    if (dxAbs > dyAbs && dxAbs > 10) {
      swiping.current = true;
      e.preventDefault();
    }
  }, [scale]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (pinchStartDist.current !== null && e.touches.length < 2) {
      pinchStartDist.current = null;
      lastPinchCenter.current = null;
      return;
    }
    panStart.current = null;
    if (!touchStart.current || scale > 1) { touchStart.current = null; return; }
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    touchStart.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) goNext(); else goPrev();
  }, [goNext, goPrev, scale]);

  // Double-tap to toggle zoom
  const lastTap = useRef(0);
  const handleTap = useCallback(() => {
    if (swiping.current) { swiping.current = false; return; }
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1) resetZoom(); else { setScale(2.5); }
    }
    lastTap.current = now;
    flashControls();
  }, [scale, resetZoom, flashControls]);

  if (!open || images.length === 0) return null;

  const idx = Math.min(current, images.length - 1);
  const currentUrl = images[idx];
  const isVideo = isVideoUrl(currentUrl);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      onClick={(e) => { if (e.target === e.currentTarget && !swiping.current && scale <= 1) onClose(); }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={`absolute right-4 top-4 z-[10000] rounded-full bg-white/20 p-2 text-white transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Fechar"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <span className={`absolute left-4 top-4 z-[10000] rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {idx + 1} / {images.length}
      </span>

      {/* Prev arrow */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev(); }}
          className={`absolute left-3 z-[10000] rounded-full bg-white/20 p-2 text-white transition-opacity duration-300 ${showControls ? 'opacity-80' : 'opacity-0 pointer-events-none'}`}
          aria-label="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Media area */}
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
      >
        {isVideo ? (
          <LightboxVideo url={currentUrl} opacity={opacity} />
        ) : (
          <LightboxImage url={currentUrl} idx={idx} opacity={opacity} scale={scale} translate={translate} onError={handleImageError} />
        )}
      </div>

      {/* Next arrow */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext(); }}
          className={`absolute right-3 z-[10000] rounded-full bg-white/20 p-2 text-white transition-opacity duration-300 ${showControls ? 'opacity-80' : 'opacity-0 pointer-events-none'}`}
          aria-label="Próximo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default ImageLightbox;
