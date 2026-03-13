import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

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
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede 5MB`);
          continue;
        }

        const ext = file.name.split('.').pop();
        const path = `${userId}/${serviceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('service-images')
          .upload(path, file);

        if (uploadError) {
          toast.error('Erro no upload: ' + uploadError.message);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('service-images')
          .getPublicUrl(path);

        const maxOrder = images.length > 0 ? Math.max(...images.map(i => i.display_order)) + 1 : 0;

        await supabase.from('service_images').insert({
          service_id: serviceId,
          image_url: urlData.publicUrl,
          display_order: maxOrder,
        });
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
    // Extract path from URL
    const urlParts = img.image_url.split('/service-images/');
    if (urlParts[1]) {
      await supabase.storage.from('service-images').remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from('service_images').delete().eq('id', img.id);
    toast.success('Imagem removida');
    fetchImages();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;

    // Swap display_order
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
