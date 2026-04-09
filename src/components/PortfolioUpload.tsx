import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface PortfolioUploadProps {
  userId: string;
  providerId: string;
}

const MAX_PORTFOLIO_IMAGES = 20;

const insertMediaRecord = async (userId: string, fileName: string, publicUrl: string, fileSize: number) => {
  const { data: profile } = await supabase.from('profiles').select('user_ref').eq('id', userId).single();
  await supabase.from('media').insert({
    storage_path: `portfolio/${userId}/${fileName}`,
    public_url: publicUrl,
    original_name: fileName,
    mime_type: 'image/jpeg',
    entity_type: 'portfolio',
    entity_ref: userId,
    user_ref: profile?.user_ref || 'unlinked',
    size_original: fileSize,
    is_active: true,
  } as any);
};

const deactivateMediaRecord = async (userId: string, fileName: string) => {
  const storagePath = `portfolio/${userId}/${fileName}`;
  await supabase.from('media').update({ is_active: false } as any).eq('storage_path', storagePath);
};

const PortfolioUpload = ({ userId, providerId }: PortfolioUploadProps) => {
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadImages = async () => {
    const { data } = await supabase.storage.from('portfolio').list(`${userId}`, { limit: 100 });
    if (data) {
      const filtered = data.filter((f) => f.name !== '.emptyFolderPlaceholder');
      setImages(
        filtered.map((f) => ({
          name: f.name,
          url: supabase.storage.from('portfolio').getPublicUrl(`${userId}/${f.name}`).data.publicUrl,
        }))
      );
    }
  };

  useEffect(() => {
    loadImages();
  }, [userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const remaining = MAX_PORTFOLIO_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Limite de ${MAX_PORTFOLIO_IMAGES} fotos atingido. Remova alguma para adicionar novas.`);
      e.target.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    if (filesToUpload.length < files.length) {
      toast.info(`Apenas ${filesToUpload.length} de ${files.length} fotos serão enviadas (limite: ${MAX_PORTFOLIO_IMAGES}).`);
    }

    setUploading(true);
    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: máximo 5MB`);
        continue;
      }
      const fileName = `${Date.now()}-${file.name}`;
      const path = `${userId}/${fileName}`;
      const { error } = await supabase.storage.from('portfolio').upload(path, file);
      if (error) {
        toast.error(`Erro: ${file.name}`);
      } else {
        const publicUrl = supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
        await insertMediaRecord(userId, fileName, publicUrl, file.size);
      }
    }
    await loadImages();
    setUploading(false);
    toast.success('Imagens enviadas!');
    e.target.value = '';
  };

  const handleDelete = async (name: string) => {
    await supabase.storage.from('portfolio').remove([`${userId}/${name}`]);
    await deactivateMediaRecord(userId, name);
    setImages((prev) => prev.filter((i) => i.name !== name));
    toast.success('Imagem removida');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Portfólio de Trabalhos</h2>
          <p className="text-xs text-muted-foreground">{images.length}/{MAX_PORTFOLIO_IMAGES} fotos</p>
        </div>
        <label className="cursor-pointer">
          <Button variant="accent" size="sm" asChild disabled={uploading || images.length >= MAX_PORTFOLIO_IMAGES}>
            <span>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </span>
          </Button>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={images.length >= MAX_PORTFOLIO_IMAGES} />
        </label>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma imagem no portfólio. Adicione fotos dos seus trabalhos!</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.name} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
              <img src={img.url} alt="Portfolio" loading="lazy" className="h-full w-full object-cover" />
              <button
                onClick={() => handleDelete(img.name)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortfolioUpload;
