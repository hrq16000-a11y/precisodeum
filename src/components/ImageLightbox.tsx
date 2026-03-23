import { useState, useCallback, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { portfolioFull } from '@/lib/imageOptimizer';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

const ImageLightbox = ({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) => {
  const [current, setCurrent] = useState(initialIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  useEffect(() => {
    if (open) setCurrent(initialIndex);
  }, [open, initialIndex]);

  const goNext = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);
    if (dx > dy && dx > 10) swiping.current = true;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    touchStart.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) goNext();
    else goPrev();
  }, [goNext, goPrev]);

  if (!open || images.length === 0) return null;

  const idx = Math.min(current, images.length - 1);
  const fullUrl = portfolioFull(images[idx]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => { if (!swiping.current) onClose(); }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[101] rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
        aria-label="Fechar"
      >
        <X className="h-6 w-6" />
      </button>

      <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
        {idx + 1} / {images.length}
      </span>

      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev(); }}
          className="absolute left-3 z-[101] hidden rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:flex"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <img
        src={fullUrl}
        alt={`Imagem ${idx + 1}`}
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain select-none"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext(); }}
          className="absolute right-3 z-[101] hidden rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:flex"
          aria-label="Próximo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default ImageLightbox;
