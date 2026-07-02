/**
 * AvatarCropDialog — recorte quadrado pré-upload.
 *
 * Por que existe:
 *  - Avatar é sempre exibido como círculo (border-radius:100%) sobre uma imagem
 *    quadrada. Subir uma foto retangular distorce o foco da face.
 *  - Comprimir antes de cortar é desperdício: o crop reduz área final, então
 *    fazemos crop → comprimir.
 *
 * UX:
 *  - Canvas 320×320 com preview circular (mask CSS).
 *  - Sliders/gestures simples: zoom (input range) + drag (pointer events).
 *  - Botões "Cancelar" e "Usar este recorte".
 *
 * Sem dependências externas — usa <canvas> nativo.
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  /** Recebe o blob recortado (sempre image/jpeg, 512×512 por padrão). */
  onConfirm: (croppedFile: File) => void;
  /** Tamanho final em px (lado). Default 512. */
  outputSize?: number;
}

const STAGE = 320; // tamanho do canvas de visualização

export default function AvatarCropDialog({ open, file, onCancel, onConfirm, outputSize = 512 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const dragging = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  // Carrega a imagem quando abre.
  useEffect(() => {
    if (!open || !file) return;
    setImgLoaded(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      // Limpa a URL — a imagem já está carregada na memória.
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setImgLoaded(false);
    };
    img.src = url;
  }, [open, file]);

  // Renderiza no canvas a cada mudança de zoom/offset.
  useEffect(() => {
    if (!imgLoaded) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = STAGE;
    canvas.height = STAGE;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE, STAGE);

    // "Cover" a área STAGE com a imagem; zoom=1 = cover mínimo (sem barras pretas).
    const baseScale = Math.max(STAGE / img.naturalWidth, STAGE / img.naturalHeight);
    const scale = baseScale * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const cx = (STAGE - drawW) / 2 + offset.x;
    const cy = (STAGE - drawH) / 2 + offset.y;
    ctx.drawImage(img, cx, cy, drawW, drawH);
  }, [imgLoaded, zoom, offset]);

  // Drag pra reposicionar.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    setOffset({
      x: dragging.current.ox + (e.clientX - dragging.current.startX),
      y: dragging.current.oy + (e.clientY - dragging.current.startY),
    });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragging.current = null;
  };

  // Exporta canvas em outputSize × outputSize.
  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || !file) return;
    setBusy(true);
    try {
      const out = document.createElement('canvas');
      out.width = outputSize;
      out.height = outputSize;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('canvas_ctx_failed');
      // Mesma matemática do preview, escalada para outputSize.
      const baseScale = Math.max(outputSize / img.naturalWidth, outputSize / img.naturalHeight);
      const scale = baseScale * zoom;
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const ratio = outputSize / STAGE;
      const cx = (outputSize - drawW) / 2 + offset.x * ratio;
      const cy = (outputSize - drawH) / 2 + offset.y * ratio;
      ctx.drawImage(img, cx, cy, drawW, drawH);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('toblob_failed');
      const cropped = new File([blob], (file.name || 'avatar').replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuste seu avatar</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div
            className="relative h-[320px] w-[320px] overflow-hidden rounded-full border-4 border-amber-300/40 bg-black select-none touch-none"
            aria-label="Área de recorte do avatar"
          >
            <canvas
              ref={canvasRef}
              width={STAGE}
              height={STAGE}
              className="block h-full w-full cursor-grab active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
          <label className="flex w-full items-center gap-3 px-1">
            <span className="text-[11px] text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-amber-500"
              aria-label="Ajustar zoom do avatar"
            />
            <span className="text-[11px] tabular-nums text-muted-foreground">{zoom.toFixed(2)}×</span>
          </label>
          <p className="text-center text-[11px] text-muted-foreground">
            Arraste a imagem dentro do círculo para enquadrar.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!imgLoaded || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Usar este recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
