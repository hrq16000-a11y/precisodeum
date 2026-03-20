import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  placeholder?: string;
}

const ImageUploadField = ({
  value,
  onChange,
  bucket = 'service-images',
  folder = '',
  label = 'Imagem',
  placeholder = 'https://...',
}: ImageUploadFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'url' | 'upload'>('url');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 1MB');
      return;
    }

    setUploading(true);
    try {
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Você precisa estar logado para enviar imagens');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      if (folder) formData.append('folder', folder);

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

      onChange(data.url);
      if (data.deduplicated) toast.info('Imagem já existente reutilizada!');
      else toast.success('Imagem enviada!');
    } catch (err) {
      toast.error('Erro ao enviar imagem');
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${mode === 'url' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LinkIcon className="inline h-3 w-3 mr-0.5" /> URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${mode === 'upload' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Upload className="inline h-3 w-3 mr-0.5" /> Upload
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20 disabled:opacity-50"
          />
          {uploading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-accent" />}
        </div>
      )}

      {value && (
        <img src={value} alt="Preview" className="mt-1 h-20 w-auto rounded-lg object-cover border border-border" />
      )}
    </div>
  );
};

export default ImageUploadField;
