import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Send, Trash2, Loader2, Clock3, Sparkles, X, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import GlassCard from '@/components/ui/GlassCard';
import { toast } from 'sonner';
import { celebrate } from '@/lib/celebrate';

interface ActivePost {
  id: string;
  image_url: string | null;
  caption: string;
  created_at: string;
  expires_at: string;
  hours_remaining: number;
}

const MAX_LEN = 240;

/**
 * "Obra do Dia" — postagem rápida que fica visível no perfil público por 48h
 * e dá um Recency Boost (+0.05) na fórmula de visibilidade v3.2.
 */
export default function DailyPostCard() {
  const { provider } = useAuth();
  const qc = useQueryClient();

  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const { data: active, isLoading } = useQuery({
    queryKey: ['daily-post', provider?.id],
    enabled: !!provider?.id,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_provider_daily_post' as any, {
        _provider_id: provider!.id,
      });
      if (error) throw error;
      const arr = (data || []) as ActivePost[];
      return arr.length > 0 ? arr[0] : null;
    },
  });

  useEffect(() => {
    if (active) {
      setCaption('');
      setImageUrl('');
    }
  }, [active]);

  if (!provider?.id) return null;

  const handlePost = async () => {
    const trimmed = caption.trim();
    if (!trimmed) {
      toast.error('Escreva uma legenda curta para a sua Obra do Dia.');
      return;
    }
    if (trimmed.length > MAX_LEN) {
      toast.error(`Máximo de ${MAX_LEN} caracteres.`);
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc('create_daily_post' as any, {
        _image_url: imageUrl.trim() || null,
        _caption: trimmed,
      });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === 'ok') {
        celebrate({ intensity: 'mini', id: `daily-post:${(data as any).post_id}` });
        toast.success('Obra do Dia publicada! 🎉', {
          description: 'Visível no seu perfil público por 48h. Você ganha um boost de visibilidade.',
        });
        qc.invalidateQueries({ queryKey: ['daily-post', provider.id] });
      } else if (status === 'no_provider') {
        toast.error('Perfil profissional não encontrado.');
      } else if (status === 'invalid_caption') {
        toast.error('Legenda inválida.');
      } else if (status === 'unauthorized') {
        toast.error('Você precisa estar logado.');
      } else {
        toast.error('Não foi possível publicar agora.');
      }
    } catch (e) {
      console.error('[create_daily_post]', e);
      toast.error('Erro ao publicar Obra do Dia.');
    } finally {
      setPosting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase.rpc('delete_daily_post' as any);
      if (error) throw error;
      toast.success('Obra do Dia removida.');
      qc.invalidateQueries({ queryKey: ['daily-post', provider.id] });
    } catch (e) {
      console.error('[delete_daily_post]', e);
      toast.error('Erro ao remover.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <GlassCard variant="default" className="overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-bold text-foreground">Obra do Dia</h3>
          <p className="text-xs text-muted-foreground">
            Mostre o que você fez hoje · destaque por 48h + boost de ranking
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
          </div>
        ) : active ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
              {active.image_url ? (
                <img
                  src={active.image_url}
                  alt="Obra do Dia"
                  loading="lazy"
                  className="mb-2 max-h-48 w-full rounded-lg object-cover"
                />
              ) : null}
              <p className="text-sm text-foreground">{active.caption}</p>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Expira em ~{Math.max(0, Math.round(active.hours_remaining))}h
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={removing}
                  className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                >
                  {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Remover
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-2"
          >
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_LEN))}
              placeholder="Ex.: Instalação de quadro elétrico concluída no Batel hoje 👷"
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Camera className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="URL da foto (opcional)"
                  className="w-full rounded-md border border-input bg-background px-8 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {caption.length}/{MAX_LEN}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handlePost}
              disabled={posting || !caption.trim()}
              className="w-full gap-1.5 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
            >
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publicar Obra do Dia
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Suba uma foto e uma frase curta. Aparece no seu perfil público e te dá um boost de
              visibilidade por 48h.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
