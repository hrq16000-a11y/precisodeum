import { useEffect, useState, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImagePlus, Trash2, Star, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { compressToWebP } from '@/lib/imageToWebp';
import { handleImageError } from '@/lib/imageResolver';

interface ServiceImage {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  storage_path?: string | null;
}

interface Props {
  serviceId: string;
  userId: string;
  maxPhotos?: number;
  onChange?: (images: ServiceImage[]) => void;
}

const MAX_DEFAULT = 5;
const BUCKET = 'service-images';

/* ───────── Sortable card ───────── */
function SortableCard({
  img, onDelete, onSetCover,
}: {
  img: ServiceImage;
  onDelete: (i: ServiceImage) => void;
  onSetCover: (i: ServiceImage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-xl overflow-hidden border-2 ${
        img.is_cover ? 'border-accent ring-2 ring-accent/30' : 'border-border'
      } bg-card group`}
    >
      <img
        src={img.image_url}
        alt="Foto do serviço"
        className="h-28 w-full object-cover"
        onError={handleImageError}
      />

      {img.is_cover && (
        <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground shadow">
          <Star className="h-2.5 w-2.5 fill-current" /> Capa
        </span>
      )}

      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 inline-flex items-center justify-center rounded-md bg-background/80 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-foreground/70 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!img.is_cover && (
          <button
            type="button"
            onClick={() => onSetCover(img)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-background hover:bg-accent hover:text-accent-foreground"
          >
            <Star className="h-3 w-3" /> Definir capa
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(img)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-background hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-3 w-3" /> Remover
        </button>
      </div>
    </div>
  );
}

/* ───────── Main component ───────── */
const ServiceImageDragUploader = ({ serviceId, userId, maxPhotos = MAX_DEFAULT, onChange }: Props) => {
  const [images, setImages] = useState<ServiceImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchImages = useCallback(async () => {
    const { data } = await supabase
      .from('service_images')
      .select('*')
      .eq('service_id', serviceId)
      .order('display_order');
    if (data) {
      setImages(data as any);
      onChange?.(data as any);
    }
  }, [serviceId, onChange]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const remainingSlots = maxPhotos - images.length;

  /* Upload pipeline: compress → upload → DB row */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesIn = e.target.files;
    if (!filesIn || filesIn.length === 0) return;
    const files = Array.from(filesIn).slice(0, remainingSlots);
    if (filesIn.length > remainingSlots) {
      toast.warning(`Você pode enviar no máximo ${maxPhotos} fotos. ${filesIn.length - remainingSlots} foram ignoradas.`);
    }

    setUploading(true);
    setProgress({ current: 0, total: files.length });
    let nextOrder = images.length > 0 ? Math.max(...images.map(i => i.display_order)) + 1 : 0;
    const noCoverYet = !images.some(i => i.is_cover);

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const raw = files[i];
        if (raw.size > 10 * 1024 * 1024) {
          toast.error(`${raw.name} excede 10MB`);
          continue;
        }

        let compressed;
        try {
          compressed = await compressToWebP(raw, { maxWidth: 1600, quality: 0.82 });
        } catch (err: any) {
          toast.error(`Falha ao processar ${raw.name}: ${err.message}`);
          continue;
        }

        const storagePath = `${userId}/${serviceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, compressed.file, {
            contentType: compressed.file.type,
            cacheControl: '31536000',
            upsert: false,
          });

        if (upErr) {
          toast.error(`Upload falhou: ${upErr.message}`);
          continue;
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        const isCover = noCoverYet && i === 0;
        const { error: insErr } = await supabase.from('service_images').insert({
          service_id: serviceId,
          image_url: pub.publicUrl,
          display_order: nextOrder,
          is_cover: isCover,
          storage_path: storagePath,
        } as any);
        if (insErr) {
          toast.error(`DB falhou: ${insErr.message}`);
          continue;
        }
        nextOrder++;

        if (compressed.savingsPercent > 0) {
          const orig = (compressed.originalSize / 1024).toFixed(0);
          const fin = (compressed.finalSize / 1024).toFixed(0);
          toast.success(`${raw.name}: ${orig}KB → ${fin}KB (-${compressed.savingsPercent}%)`);
        }
      }

      await fetchImages();
    } finally {
      setUploading(false);
      setProgress(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (img: ServiceImage) => {
    if (img.storage_path) {
      await supabase.storage.from(BUCKET).remove([img.storage_path]);
    } else {
      const m = img.image_url.split(`/${BUCKET}/`)[1];
      if (m) await supabase.storage.from(BUCKET).remove([decodeURIComponent(m)]);
    }
    await supabase.from('service_images').delete().eq('id', img.id);

    // If the cover got deleted, promote the first remaining
    if (img.is_cover) {
      const remaining = images.filter(i => i.id !== img.id);
      if (remaining[0]) {
        await supabase.from('service_images').update({ is_cover: true } as any).eq('id', remaining[0].id);
      }
    }
    toast.success('Foto removida');
    fetchImages();
  };

  const handleSetCover = async (img: ServiceImage) => {
    // Clear any existing cover, then set this one (unique partial index protects us).
    await supabase.from('service_images').update({ is_cover: false } as any).eq('service_id', serviceId);
    await supabase.from('service_images').update({ is_cover: true } as any).eq('id', img.id);
    toast.success('Foto de capa atualizada');
    fetchImages();
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIdx = images.findIndex(i => i.id === active.id);
    const newIdx = images.findIndex(i => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(images, oldIdx, newIdx).map((img, idx) => ({
      ...img, display_order: idx,
    }));
    setImages(reordered);

    // Persist
    await Promise.all(
      reordered.map(img =>
        supabase.from('service_images').update({ display_order: img.display_order } as any).eq('id', img.id),
      ),
    );
    onChange?.(reordered);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Fotos do serviço</p>
          <p className="text-[11px] text-muted-foreground">
            {images.length}/{maxPhotos} fotos · arraste para reordenar · 1ª foto é a capa
          </p>
        </div>

        <label className={remainingSlots > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading || remainingSlots <= 0}
          />
          <Button variant="outline" size="sm" asChild disabled={uploading || remainingSlots <= 0}>
            <span>
              {uploading ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enviando {progress?.current}/{progress?.total}</>
              ) : (
                <><ImagePlus className="mr-1 h-4 w-4" /> Adicionar</>
              )}
            </span>
          </Button>
        </label>
      </div>

      {images.length === 0 ? (
        <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-accent hover:bg-accent/5'} transition-colors`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Adicione até {maxPhotos} fotos do seu serviço</p>
          <p className="text-[11px] text-muted-foreground">JPG, PNG ou WebP · convertemos e otimizamos automaticamente</p>
        </label>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map(img => (
                <SortableCard
                  key={img.id}
                  img={img}
                  onDelete={handleDelete}
                  onSetCover={handleSetCover}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default ServiceImageDragUploader;
