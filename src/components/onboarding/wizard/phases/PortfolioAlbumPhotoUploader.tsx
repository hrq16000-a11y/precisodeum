/**
 * PortfolioAlbumPhotoUploader — uploader inline reutilizável de fotos de
 * portfólio para um álbum específico. Mesma stack usada no Dashboard:
 *  - Edge function `optimize-image` (compressão + dedup)
 *  - RPC `add_portfolio_photo_atomic` (insere foto vinculada ao álbum)
 *  - `upsertMedia()` (registro unificado em `media`)
 *
 * Usado pelo Wizard (Step21_PortfolioAlbums) para permitir envio de fotos
 * por álbum direto no onboarding, sem mandar o usuário pra outra tela.
 */
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { upsertMedia, resolveIdentity } from '@/lib/mediaUtils';

interface AlbumPhoto {
  id: string;
  image_url: string;
  storage_path: string;
}

interface Props {
  albumId: string;
  userId: string;
  /** Limite por álbum (default 20). */
  maxPhotos?: number;
  /** Callback opcional após upload bem-sucedido (ex: refresh contador). */
  onChange?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function PortfolioAlbumPhotoUploader({
  albumId,
  userId,
  maxPhotos = 20,
  onChange,
}: Props) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data } = await (supabase as any)
      .from('portfolio_photos')
      .select('id, image_url, storage_path')
      .eq('album_id', albumId)
      .order('display_order', { ascending: true });
    setPhotos(((data as AlbumPhoto[]) || []));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  const reachedCap = photos.length >= maxPhotos;

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !userId) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      toast.error(`Limite de ${maxPhotos} fotos por álbum.`);
      e.target.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    if (filesToUpload.length < files.length) {
      toast.info(`Apenas ${filesToUpload.length} fotos serão enviadas (limite: ${maxPhotos}).`);
    }

    setUploading(true);
    setProgress({ current: 0, total: filesToUpload.length });
    let successCount = 0;
    const { userRef } = await resolveIdentity(userId);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();

    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const file = filesToUpload[idx];
      setProgress({ current: idx + 1, total: filesToUpload.length });
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: máximo 5MB`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', 'portfolio');
        formData.append('folder', `${userId}/${albumId}`);

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
        if (data.error) throw new Error(data.error);

        const { error: rpcErr } = await supabase.rpc('add_portfolio_photo_atomic' as any, {
          _album_id: albumId,
          _image_url: data.url,
          _storage_path: data.path,
          _original_name: file.name,
        });
        if (rpcErr) throw rpcErr;

        if (userRef) {
          await upsertMedia({
            storagePath: `portfolio/${data.path}`,
            publicUrl: data.url,
            originalName: file.name,
            mimeType: file.type || 'image/jpeg',
            entityType: 'portfolio',
            entityRef: albumId,
            userRef,
            sizeOriginal: file.size,
          });
        }
        successCount++;
      } catch (err: any) {
        toast.error(`Erro: ${file.name}`, { description: err?.message });
      }
    }

    setUploading(false);
    setProgress(null);
    e.target.value = '';
    if (successCount > 0) {
      toast.success(`${successCount} foto${successCount > 1 ? 's' : ''} enviada${successCount > 1 ? 's' : ''}!`);
    }
    await refresh();
    onChange?.();
  };

  const handleRemove = async (photo: AlbumPhoto) => {
    try {
      await (supabase as any).from('portfolio_photos').delete().eq('id', photo.id);
      if (photo.storage_path) {
        await supabase.storage.from('portfolio').remove([photo.storage_path]);
      }
      toast.success('Foto removida');
      await refresh();
      onChange?.();
    } catch (e: any) {
      toast.error('Não foi possível remover', { description: e?.message });
    }
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando fotos…</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <img
                src={p.image_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleRemove(p)}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive opacity-0 transition group-hover:opacity-100 focus:opacity-100 sm:opacity-100"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {!reachedCap && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Adicionar</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleSelect}
        disabled={uploading || reachedCap}
      />

      {progress && (
        <div className="space-y-1">
          <Progress value={(progress.current / progress.total) * 100} className="h-1" />
          <p className="text-[10px] text-muted-foreground">
            Enviando {progress.current}/{progress.total}…
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{photos.length}/{maxPhotos} fotos</span>
        {!reachedCap && !uploading && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[10px]"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-3 w-3" /> Enviar fotos
          </Button>
        )}
      </div>
    </div>
  );
}
