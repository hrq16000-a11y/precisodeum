import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { handleImageError } from '@/lib/imageResolver';
import { upsertMedia, deactivateMedia, resolveIdentity } from '@/lib/mediaUtils';
import { generateBlurDataUrl } from '@/lib/compressImage';
import { uploadWithFallback } from '@/lib/uploadWithFallback';
import { UploadTimeoutError } from '@/lib/uploadResilient';
import { validateImageFile } from '@/lib/imageValidation';
import {
  UploadProgressIndicator,
  makeInitialStages,
  type UploadStagesState,
} from '@/components/upload/UploadProgressIndicator';

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
  const [stages, setStages] = useState<UploadStagesState>(makeInitialStages());
  const [hasFailed, setHasFailed] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState<{ attempt: number; max: number; reason?: string } | null>(null);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const pendingFilesRef = useRef<File[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  // Cleanup das object URLs ao desmontar.
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      previewUrlsRef.current = [];
    };
  }, []);

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

  const MAX_IMAGES = 5; // 1 capa + 4 conteúdos

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES} fotos por serviço (1 capa + 4 conteúdos).`);
      e.target.value = '';
      return;
    }

    const candidates = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Só ${remaining} foto(s) restantes. Apenas as primeiras serão enviadas.`);
    }

    // Valida tipo/tamanho/dimensões de cada arquivo ANTES de iniciar o batch
    const toUpload: File[] = [];
    for (const f of candidates) {
      const v = await validateImageFile(f, {
        maxSizeBytes: 5 * 1024 * 1024,
        minDimension: 64,
        maxDimension: 6000,
      });
      if (!v.ok) {
        toast.error(`${f.name}: ${v.message}`);
        continue;
      }
      toUpload.push(f);
    }

    if (toUpload.length === 0) {
      e.target.value = '';
      return;
    }

    // Prévia local IMEDIATA (mantém UI responsiva enquanto comprime/envia)
    previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const newPreviews = toUpload.map((f) => URL.createObjectURL(f));
    previewUrlsRef.current = newPreviews;
    setLocalPreviews(newPreviews);

    await runBatch(toUpload);
    e.target.value = '';
  };

  const runBatch = async (toUpload: File[]) => {
    pendingFilesRef.current = toUpload;
    setUploading(true);
    setHasFailed(false);
    setAttemptInfo(null);
    setStages(makeInitialStages());

    try {
      const { userRef } = await resolveIdentity(userId);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Você precisa estar logado');
        return;
      }

      let nextOrder = images.length > 0 ? Math.max(...images.map(i => i.display_order)) + 1 : 0;
      const failed: File[] = [];

      for (const raw of toUpload) {
        // Validação já foi feita no handleUpload — sem dupla checagem aqui.
        setStages(makeInitialStages());

        try {
          const result = await uploadWithFallback<any>(raw, {
            url: `https://${projectId}.supabase.co/functions/v1/optimize-image`,
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${session.access_token}`,
            },
            baseMaxDimension: 1200,
            baseTargetKB: 300,
            buildFormData: (file) => {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('bucket', 'service-images');
              fd.append('folder', `${userId}/${serviceId}`);
              return fd;
            },
            onStage: ({ stage, status }) => {
              setStages((prev) => {
                if (stage === 'fallback') return prev;
                return {
                  ...prev,
                  [stage]: status === 'start' ? 'active' : status === 'error' ? 'error' : 'done',
                };
              });
            },
            onAttempt: (a, max, reason) => {
              setAttemptInfo({ attempt: a, max, reason });
              if (a > 1) {
                const msg =
                  reason === 'timeout'
                    ? `${raw.name}: tempo esgotado, retentando (${a}/${max})…`
                    : reason === 'network'
                    ? `${raw.name}: sem rede, reenviando (${a}/${max})…`
                    : `${raw.name}: tentando novamente (${a}/${max})…`;
                toast.message(msg);
              }
            },
          });

          const data = result.data;
          if (data.error) {
            failed.push(raw);
            continue;
          }

          await supabase.from('service_images').insert({
            service_id: serviceId,
            image_url: data.url,
            display_order: nextOrder,
          });
          nextOrder++;

          if (userRef && data.path) {
            const blurDataUrl = await generateBlurDataUrl(raw);
            await upsertMedia({
              storagePath: `service-images/${data.path}`,
              publicUrl: data.url,
              originalName: raw.name,
              mimeType: raw.type || 'image/jpeg',
              entityType: 'service',
              entityRef: serviceId,
              userRef,
              sizeOriginal: raw.size,
              blurDataUrl: blurDataUrl || undefined,
            });
          }

          if (result.fallbackLevel > 0) {
            toast.success(`${raw.name} enviada (qualidade reduzida — nível ${result.fallbackLevel}).`);
          }
        } catch (err) {
          failed.push(raw);
          if (err instanceof UploadTimeoutError) {
            toast.error(`${raw.name}: conexão muito lenta.`);
          } else {
            toast.error(`Falha ao enviar ${raw.name}.`);
          }
        }
      }

      if (failed.length > 0) {
        pendingFilesRef.current = failed;
        setHasFailed(true);
        setStages((prev) => ({ ...prev, upload: 'error' }));
      } else {
        toast.success('Imagens enviadas!');
        pendingFilesRef.current = [];
        // Limpa prévias locais — agora as fotos reais aparecem no grid.
        previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        previewUrlsRef.current = [];
        setLocalPreviews([]);
      }
      fetchImages();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      setHasFailed(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async () => {
    if (pendingFilesRef.current.length > 0) {
      await runBatch(pendingFilesRef.current);
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

  const reachedMax = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-sm font-medium text-foreground">Fotos do serviço</label>
          <p className="text-[11px] text-muted-foreground">
            1 capa + até 4 fotos de conteúdo. {images.length}/{MAX_IMAGES} usadas.
          </p>
        </div>
        <label className={reachedMax ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading || reachedMax}
          />
          <Button variant="outline" size="sm" asChild disabled={uploading || reachedMax}>
            <span>
              <ImagePlus className="mr-1 h-4 w-4" />
              {uploading ? 'Enviando...' : reachedMax ? 'Limite atingido' : 'Adicionar'}
            </span>
          </Button>
        </label>
      </div>

      {(uploading || hasFailed) && (
        <div className="space-y-2">
          <UploadProgressIndicator stages={stages} />
          {hasFailed && !uploading && pendingFilesRef.current.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente ({pendingFilesRef.current.length})
            </Button>
          )}
        </div>
      )}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
              {idx === 0 && (
                <span className="absolute left-1 top-1 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow">
                  Capa
                </span>
              )}
              <img
                src={img.image_url}
                alt={idx === 0 ? 'Capa do serviço' : `Foto ${idx + 1} do serviço`}
                className="w-full h-28 object-cover"
                onError={handleImageError}
              />
              <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {idx > 0 && (
                  <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => handleMove(idx, 'up')} title={idx === 1 ? 'Tornar capa' : 'Mover para cima'}>
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

      {images.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          Nenhuma foto ainda. A primeira enviada vira a capa do anúncio.
        </div>
      )}
    </div>
  );
};

export default ServiceImageUpload;
