import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { handleImageError } from '@/lib/imageResolver';
import { upsertMedia, deactivateMedia, resolveIdentity } from '@/lib/mediaUtils';
import { compressImage } from '@/lib/compressImage';

interface ServiceImage {
  id: string;
  image_url: string;
  display_order: number;
}

interface ServiceImageUploadProps {
  serviceId: string;
  userId: string;
}

const ServiceImageUpload = ({ serviceId, userId }: ServiceImageUploadProps) => {
  const [images, setImages] = useState<ServiceImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchImages = async () => {
    const { data } = await supabase
      .from('service_images')
      .select('*')
      .eq('service_id', serviceId)
      .order('display_order');
    if (data) setImages(data);
  };

  useEffect(() => {
    fetchImages();
  }, [serviceId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { userRef } = await resolveIdentity(userId);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      for (const raw of Array.from(files)) {
        if (raw.size > 5 * 1024 * 1024) {
          toast.error(`${raw.name} excede 5MB`);
          continue;
        }

        const file = await compressImage(raw);

        const formData = new FormData();
        formData.append('bucket', 'service-images');
        formData.append('folder', `${userId}/${serviceId}`);

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/optimize-image`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }
        );

        const data = await res.json();
        if (data.error) {
          toast.error('Erro no upload: ' + data.error);
          continue;
        }

        const publicUrl = data.url;
        const storagePath = data.path;

        if (data.deduplicated) {
          toast.info(`${file.name}: imagem reutilizada (duplicada)`);
        } else if (data.savings_percent > 0) {
          const origKB = Math.round((data.original_size || 0) / 1024);
          const optKB = Math.round((data.optimized_size || 0) / 1024);
          const origLabel = origKB >= 1024 ? `${(origKB / 1024).toFixed(1)}MB` : `${origKB}KB`;
          const optLabel = optKB >= 1024 ? `${(optKB / 1024).toFixed(1)}MB` : `${optKB}KB`;
          toast.success(`Imagem otimizada: ${origLabel} → ${optLabel} (-${data.savings_percent}%)`);
        }

        const maxOrder = images.length > 0 ? Math.max(...images.map(i => i.display_order)) + 1 : 0;

        await supabase.from('service_images').insert({
          service_id: serviceId,
          image_url: publicUrl,
          display_order: maxOrder,
        });

        // Idempotent media upsert
        if (userRef) {
          await upsertMedia({
            storagePath: `service-images/${storagePath}`,
            publicUrl,
            originalName: file.name,
            mimeType: file.type || 'image/jpeg',
            entityType: 'service',
            entityRef: serviceId,
            userRef,
            sizeOriginal: file.size,
          });
        }
      }

      toast.success('Imagens enviadas!');
      fetchImages();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (img: ServiceImage) => {
    const urlParts = img.image_url.split('/service-images/');
    if (urlParts[1]) {
      await supabase.storage.from('service-images').remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from('service_images').delete().eq('id', img.id);

    // Deactivate in media table with audit
    await deactivateMedia(
      urlParts[1] ? `service-images/${decodeURIComponent(urlParts[1])}` : img.image_url,
      'service'
    );

    toast.success('Imagem removida');
    fetchImages();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;

    const tempOrder = newImages[index].display_order;
    newImages[index].display_order = newImages[swapIndex].display_order;
    newImages[swapIndex].display_order = tempOrder;

    await Promise.all([
      supabase.from('service_images').update({ display_order: newImages[index].display_order }).eq('id', newImages[index].id),
      supabase.from('service_images').update({ display_order: newImages[swapIndex].display_order }).eq('id', newImages[swapIndex].id),
    ]);

    fetchImages();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Fotos do serviço</label>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <Button variant="outline" size="sm" asChild disabled={uploading}>
            <span>
              <ImagePlus className="mr-1 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Adicionar'}
            </span>
          </Button>
        </label>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
              <img
                src={img.image_url}
                alt="Foto do serviço"
                className="w-full h-28 object-cover"
                onError={handleImageError}
              />
              <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {idx > 0 && (
                  <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => handleMove(idx, 'up')}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                )}
                {idx < images.length - 1 && (
                  <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => handleMove(idx, 'down')}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(img)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceImageUpload;
