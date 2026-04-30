import { useState, useRef, forwardRef } from 'react';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { upsertMedia, resolveIdentity } from '@/lib/mediaUtils';
import { generateBlurDataUrl } from '@/lib/compressImage';
import { UploadTimeoutError } from '@/lib/uploadResilient';
import { uploadWithFallback } from '@/lib/uploadWithFallback';
import { validateImageFile } from '@/lib/imageValidation';
import { useLocalThumbnail } from '@/hooks/useLocalThumbnail';
import {
  UploadProgressIndicator,
  makeInitialStages,
  type UploadStagesState,
} from '@/components/upload/UploadProgressIndicator';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateProviderCaches } from '@/lib/providerCacheInvalidation';

interface AvatarUploadProps {
  userId: string;
  currentUrl?: string | null;
  initials: string;
  onUploaded: (url: string) => void;
}

const AvatarUpload = forwardRef<HTMLDivElement, AvatarUploadProps>(
  ({ userId, currentUrl, initials, onUploaded }, ref) => {
    const [uploading, setUploading] = useState(false);
    const [stages, setStages] = useState<UploadStagesState>(makeInitialStages());
    const [hasFailed, setHasFailed] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const lastFileRef = useRef<File | null>(null);
    const queryClient = useQueryClient();

    const runUpload = async (raw: File) => {
      lastFileRef.current = raw;
      setUploading(true);
      setHasFailed(false);
      setStages(makeInitialStages());

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error('Você precisa estar logado');
          setUploading(false);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const headers = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        };

        const result = await uploadWithFallback<{ url: string; path?: string; error?: string }>(
          raw,
          {
            url: `https://${projectId}.supabase.co/functions/v1/optimize-image`,
            headers,
            baseMaxDimension: 512,
            baseTargetKB: 200,
            buildFormData: (file) => {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('bucket', 'avatars');
              fd.append('folder', userId);
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
            onAttempt: (a, max) => {
              if (a > 1) toast.message(`Conexão lenta. Tentando novamente (${a}/${max})…`);
            },
          }
        );

        if (result.data.error) throw new Error(result.data.error);
        const publicUrl = result.data.url;

        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
        const { userRef, providerId } = await resolveIdentity(userId);
        if (userRef) {
          const blurDataUrl = await generateBlurDataUrl(raw);
          await upsertMedia({
            storagePath: `avatars/${userId}/${raw.name}`,
            publicUrl,
            originalName: raw.name,
            mimeType: raw.type || 'image/jpeg',
            entityType: 'profile',
            entityRef: providerId || userId,
            userRef,
            sizeOriginal: raw.size,
            blurDataUrl: blurDataUrl || undefined,
          });
        }

        onUploaded(publicUrl);
        invalidateProviderCaches(queryClient, { reason: 'avatar-upload', userId });

        if (result.fallbackLevel > 0) {
          toast.success(`Foto enviada (qualidade reduzida — nível ${result.fallbackLevel}).`);
        } else {
          toast.success('Foto atualizada!');
        }
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

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.files?.[0];
      if (!raw) return;
      if (raw.size > 5 * 1024 * 1024) {
        toast.error('Imagem deve ter no máximo 5MB');
        return;
      }
      await runUpload(raw);
    };

    const handleRetry = async () => {
      if (lastFileRef.current) await runUpload(lastFileRef.current);
    };

    return (
      <div ref={ref} className="inline-block">
        <div className="relative inline-block">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={currentUrl || undefined} alt="Avatar" />
            <AvatarFallback className="bg-gradient-to-br from-accent/20 to-primary/15 text-accent text-2xl font-bold tracking-wide">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md hover:bg-accent/90 transition-colors"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {(uploading || hasFailed) && (
          <div className="mt-2 w-56 max-w-full">
            <UploadProgressIndicator stages={stages} />
            {hasFailed && !uploading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleRetry}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Tentar novamente
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);

AvatarUpload.displayName = 'AvatarUpload';
export default AvatarUpload;
