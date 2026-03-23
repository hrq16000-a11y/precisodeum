import { useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { portfolioFull } from '@/lib/imageOptimizer';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const ImageLightbox = ({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) => {
  const [current, setCurrent] = useState(initialIndex);

  const goNext = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  if (!open || images.length === 0) return null;

  const idx = Math.min(current, images.length - 1);
  const fullUrl = portfolioFull(images[idx]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[101] rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
        aria-label="Fechar"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
        {idx + 1} / {images.length}
      </span>

      {/* Previous */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev(); }}
          className="absolute left-3 z-[101] rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={fullUrl}
        alt={`Imagem ${idx + 1}`}
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        onClick={e => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext(); }}
          className="absolute right-3 z-[101] rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
          aria-label="Próximo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default ImageLightbox;
