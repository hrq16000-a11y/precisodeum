import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface Area { x: number; y: number; width: number; height: number }

interface AvatarCropDialogProps {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => Promise<void> | void;
}

/**
 * Crop circular (output 512×512 JPEG) com zoom e rotação.
 * Mobile-first: gestos touch nativos do react-easy-crop, controles grandes.
 * O resultado é entregue como `File` JPEG pronto para o upload existente.
 */
async function getCroppedFile(
  imageSrc: string,
  cropArea: Area,
  rotation: number,
  originalName: string,
): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });

  const OUT = 512;
  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  // For rotation, draw onto an oversized temp canvas first.
  const safe = Math.max(img.width, img.height) * 2;
  const tmp = document.createElement('canvas');
  tmp.width = safe;
  tmp.height = safe;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new Error('Canvas indisponível');

  tctx.translate(safe / 2, safe / 2);
  tctx.rotate((rotation * Math.PI) / 180);
  tctx.translate(-img.width / 2, -img.height / 2);
  tctx.drawImage(img, 0, 0);

  // Crop offset on the rotated canvas:
  const dx = safe / 2 - img.width / 2 + cropArea.x;
  const dy = safe / 2 - img.height / 2 + cropArea.y;

  ctx.drawImage(
    tmp,
    dx, dy, cropArea.width, cropArea.height,
    0, 0, OUT, OUT,
  );

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar JPEG'))), 'image/jpeg', 0.9),
  );
  const base = originalName.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg' });
}

const AvatarCropDialog = ({ open, file, onCancel, onConfirm }: AvatarCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const objectUrl = file ? URL.createObjectURL(file) : '';

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setCropArea(area);
  }, []);

  const handleConfirm = async () => {
    if (!file || !cropArea) return;
    setWorking(true);
    try {
      const cropped = await getCroppedFile(objectUrl, cropArea, rotation, file.name);
      await onConfirm(cropped);
    } finally {
      setWorking(false);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setZoom(1);
      setRotation(0);
      setCrop({ x: 0, y: 0 });
    }
  };

  const handleCancel = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Ajustar foto</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Arraste para reposicionar. Use o zoom para enquadrar seu rosto.
          </p>
        </DialogHeader>

        <div className="relative h-72 w-full bg-black sm:h-80">
          {file && (
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              objectFit="cover"
            />
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="w-full"
          >
            <RotateCw className="mr-1.5 h-4 w-4" /> Girar 90°
          </Button>
        </div>

        <DialogFooter className="p-4 pt-0 flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={working} className="flex-1">
            Cancelar
          </Button>
          <Button variant="accent" onClick={handleConfirm} disabled={working || !cropArea} className="flex-1">
            {working ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
