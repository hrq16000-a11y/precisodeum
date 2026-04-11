import { useState, useRef, forwardRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { upsertMedia, resolveIdentity } from '@/lib/mediaUtils';
import { compressImage } from '@/lib/compressImage';

interface AvatarUploadProps {
  userId: string;
  currentUrl?: string | null;
  initials: string;
  onUploaded: (url: string) => void;
}

const AvatarUpload = forwardRef<HTMLDivElement, AvatarUploadProps>(({ userId, currentUrl, initials, onUploaded }, ref) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    if (raw.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const file = await compressImage(raw, { maxDimension: 512, targetKB: 200 });
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Você precisa estar logado');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'avatars');
      formData.append('folder', userId);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/optimize-image`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const publicUrl = data.url;
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

      // Resolve identity: user_ref + provider_id
      const { userRef, providerId } = await resolveIdentity(userId);

      if (userRef) {
        await upsertMedia({
          storagePath: `avatars/${userId}/${file.name}`,
          publicUrl,
          originalName: file.name,
          mimeType: file.type || 'image/jpeg',
          entityType: 'profile',
          entityRef: providerId || userId,
          userRef,
          sizeOriginal: file.size,
        });
      }

      onUploaded(publicUrl);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar imagem');
    }
    setUploading(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
        <AvatarImage src={currentUrl || undefined} alt="Avatar" />
        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
          {initials}
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
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
});

AvatarUpload.displayName = 'AvatarUpload';
export default AvatarUpload;
