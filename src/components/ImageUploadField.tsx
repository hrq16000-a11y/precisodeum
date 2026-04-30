import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Link as LinkIcon, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { handleImageError } from '@/lib/imageResolver';
import { generateBlurDataUrl } from '@/lib/compressImage';
import { UploadTimeoutError } from '@/lib/uploadResilient';
import { uploadWithFallback } from '@/lib/uploadWithFallback';
import { upsertMedia, resolveIdentity } from '@/lib/mediaUtils';
import { validateImageFile } from '@/lib/imageValidation';
import { useLocalThumbnail } from '@/hooks/useLocalThumbnail';
import {
  UploadProgressIndicator,
  makeInitialStages,
  type UploadStagesState,
} from '@/components/upload/UploadProgressIndicator';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  placeholder?: string;
  /** Entity type for media library tracking (e.g. 'sponsor', 'banner', 'category') */
  entityType?: string;
  /** Entity reference ID for media library tracking */
  entityRef?: string;
}

const ImageUploadField = ({
  value,
  onChange,
  bucket = 'service-images',
  folder = '',
  label = 'Imagem',
  placeholder = 'https://...',
  entityType,
  entityRef,
}: ImageUploadFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [stages, setStages] = useState<UploadStagesState>(makeInitialStages());
  const [hasFailed, setHasFailed] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState<{ attempt: number; max: number; reason?: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const localPreview = useLocalThumbnail(pendingFile);

  const runUpload = async (raw: File) => {
    lastFileRef.current = raw;
    setPendingFile(raw);
    setUploading(true);
    setHasFailed(false);
    setAttemptInfo(null);
    setStages(makeInitialStages());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Você precisa estar logado para enviar imagens');
        setUploading(false);
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const result = await uploadWithFallback<{
        url: string;
        path?: string;
        deduplicated?: boolean;
        error?: string;
      }>(raw, {
        url: `https://${projectId}.supabase.co/functions/v1/optimize-image`,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        baseMaxDimension: 1200,
        baseTargetKB: 300,
        buildFormData: (file) => {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('bucket', bucket);
          if (folder) fd.append('folder', folder);
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
                ? `Tempo esgotado. Tentando novamente (${a}/${max})…`
                : reason === 'network'
                ? `Sem rede. Reenviando (${a}/${max})…`
                : `Tentando novamente (${a}/${max})…`;
            toast.message(msg);
          }
        },
      });

      if (result.data.error) throw new Error(result.data.error);
      onChange(result.data.url);

      if (entityType && result.data.path) {
        const identity = await resolveIdentity(session.user.id);
        if (identity.userRef) {
          const blurDataUrl = await generateBlurDataUrl(raw);
          upsertMedia({
            storagePath: result.data.path,
            publicUrl: result.data.url,
            originalName: raw.name,
            mimeType: raw.type || 'image/webp',
            entityType,
            entityRef: entityRef || 'admin',
            userRef: identity.userRef,
            sizeOriginal: raw.size,
            blurDataUrl: blurDataUrl || undefined,
          });
        }
      }

      if (result.data.deduplicated) toast.info('Imagem já existente reutilizada!');
      else if (result.fallbackLevel > 0)
        toast.success(`Imagem enviada (qualidade reduzida — nível ${result.fallbackLevel}).`);
      else toast.success('Imagem enviada!');
    } catch (err) {
      setStages((prev) => ({ ...prev, upload: 'error' }));
      setHasFailed(true);
      if (err instanceof UploadTimeoutError) {
        toast.error('Conexão muito lenta. Toque em "Tentar novamente".');
      } else {
        toast.error('Erro ao enviar imagem. Toque em "Tentar novamente".');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const v = await validateImageFile(raw, {
      maxSizeBytes: 5 * 1024 * 1024,
      minDimension: 64,
      maxDimension: 6000,
    });
    if (!v.ok) {
      toast.error(v.message ?? 'Arquivo inválido');
      e.target.value = '';
      return;
    }
    await runUpload(raw);
  };

  const handleRetry = async () => {
    if (lastFileRef.current) await runUpload(lastFileRef.current);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'url'
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon className="inline h-3 w-3 mr-0.5" /> URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="inline h-3 w-3 mr-0.5" /> Upload
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20 disabled:opacity-50"
            />
            {uploading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-accent" />
            )}
          </div>

          {/* Prévia local instantânea — aparece antes mesmo da compressão começar. */}
          {localPreview && (uploading || hasFailed) && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-2">
              <img
                src={localPreview}
                alt="Prévia"
                width={56}
                height={56}
                className="h-14 w-14 rounded object-cover"
              />
              <div className="text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Prévia local</p>
                <p>Versão otimizada está sendo enviada…</p>
              </div>
            </div>
          )}

          {(uploading || hasFailed) && <UploadProgressIndicator stages={stages} />}

          {attemptInfo && attemptInfo.attempt > 1 && (
            <p className="text-[11px] text-muted-foreground" aria-live="polite">
              Tentativa {attemptInfo.attempt}/{attemptInfo.max}
              {attemptInfo.reason === 'timeout' && ' — tempo esgotado, reenviando…'}
              {attemptInfo.reason === 'network' && ' — sem rede, aguardando reconexão…'}
              {attemptInfo.reason === 'server' && ' — servidor instável, retentando…'}
            </p>
          )}

          {hasFailed && !uploading && (
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
            </Button>
          )}
        </div>
      )}

      {value && !localPreview && (
        <img
          src={value}
          alt="Preview"
          width={80}
          height={80}
          className="mt-1 h-20 w-auto rounded-lg object-cover border border-border"
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export default ImageUploadField;
