/**
 * Step21_PortfolioAlbums — Wizard linear, fase opcional.
 *
 * Permite ao prestador criar até 5 álbuns de portfólio direto no onboarding.
 * Criação enxuta (apenas título + descrição opcional) — o upload de fotos
 * dentro de cada álbum é gerenciado depois pelo painel /dashboard/portfolio.
 *
 * Por que enxuto? O upload em massa dentro do wizard travaria o fluxo.
 * Aqui criamos os "espaços" temáticos; o usuário enche depois ou via painel.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, SkipForward, X, FolderPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import PortfolioAlbumPhotoUploader from './PortfolioAlbumPhotoUploader';

const MAX_ALBUMS = 5;

interface Album { id: string; name: string; description: string | null; }

interface Step21Props {
  onContinue: () => void;
  onSkip: () => void;
  onGoToPath?: (path: string) => Promise<void> | void;
}

const Step21_PortfolioAlbums = ({ onContinue, onSkip, onGoToPath }: Step21Props) => {
  const navigate = useNavigate();
  const [navigating, setNavigating] = useState<string | null>(null);
  const goTo = useCallback(async (path: string) => {
    setNavigating(path);
    try {
      if (onGoToPath) await onGoToPath(path);
      else navigate(path);
    } finally {
      setNavigating(null);
    }
  }, [navigate, onGoToPath]);
  const { user, provider } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(provider?.id ?? null);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);

  // Garante providerId mesmo se o context ainda não tiver carregado
  useEffect(() => {
    if (providerId || !user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active && data?.id) setProviderId(data.id);
    })();
    return () => { active = false; };
  }, [providerId, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('portfolio_albums')
      .select('id, name, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setAlbums((data || []) as Album[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const reachedCap = albums.length >= MAX_ALBUMS;

  const handleSave = useCallback(async () => {
    if (!user?.id || !providerId || !name.trim()) return;
    setSaving(true);
    try {
      const { data: created, error } = await supabase
        .from('portfolio_albums')
        .insert({
          user_id: user.id,
          provider_id: providerId,
          name: name.trim(),
          description: desc.trim(),
        })
        .select('id')
        .single();
      if (error) throw error;
      setName('');
      setDesc('');
      setCreating(false);
      await refresh();
      // Auto-expande o álbum recém-criado para o usuário já enviar fotos
      if (created?.id) setExpandedAlbumId(created.id);
      toast.success('Álbum criado — agora envie suas fotos');
    } catch (e: any) {
      toast.error('Não foi possível criar o álbum', { description: e?.message });
    } finally {
      setSaving(false);
    }
  }, [user?.id, providerId, name, desc, refresh]);

  const handleRemove = useCallback(async (id: string) => {
    const { error } = await supabase.from('portfolio_albums').delete().eq('id', id);
    if (error) {
      toast.error('Não foi possível remover');
      return;
    }
    await refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-2 space-y-2.5">
      <header className="text-center space-y-0.5">
        <h2 className="font-display text-lg font-extrabold leading-tight text-foreground">Crie seus álbuns de portfólio</h2>
        <p className="text-xs text-muted-foreground">
          Organize seus trabalhos por tema (ex: "Reformas", "Eventos"). Até{' '}
          <span className="font-medium text-foreground">{MAX_ALBUMS} álbuns</span>.
          Crie um álbum e toque nele para abrir o envio de fotos agora mesmo.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Álbuns criados</span>
          <span className="text-xs font-bold">{albums.length} / {MAX_ALBUMS}</span>
        </div>
        {loading ? (
          <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
        ) : albums.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nenhum álbum ainda — crie o primeiro abaixo.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {albums.map(a => {
              const expanded = expandedAlbumId === a.id;
              return (
                <li key={a.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedAlbumId(expanded ? null : a.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {expanded
                        ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        {a.description && (
                          <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(a.id)}
                      className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remover álbum"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded && user?.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pt-2"
                      >
                        <PortfolioAlbumPhotoUploader
                          albumId={a.id}
                          userId={user.id}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AnimatePresence initial={false}>
        {creating ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden rounded-lg border border-accent/40 bg-background p-3"
          >
            <Input
              placeholder="Nome do álbum (ex: Reformas residenciais)"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 60))}
              maxLength={60}
            />
            <Textarea
              placeholder="Descrição curta (opcional)"
              value={desc}
              onChange={e => setDesc(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => { setCreating(false); setName(''); setDesc(''); }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? 'Salvando…' : 'Criar álbum'}
              </Button>
            </div>
          </motion.div>
        ) : (
          !reachedCap && (
            <Button
              key="add"
              type="button"
              variant="outline"
              onClick={() => setCreating(true)}
              className="w-full gap-2"
            >
              <FolderPlus className="h-4 w-4" /> Criar novo álbum
            </Button>
          )
        )}
      </AnimatePresence>

      <div className="rounded-lg border border-border bg-card p-3 text-left">
        <p className="text-sm font-medium text-foreground">Como colocar fotos</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          1. Crie um álbum. 2. Toque no nome do álbum. 3. Envie as fotos na área que abre logo abaixo.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild type="button" variant="outline" className="gap-2">
            <Link to="/dashboard/portfolio">Abrir portfólio</Link>
          </Button>
          <Button asChild type="button" variant="outline" className="gap-2">
            <Link to="/dashboard">Ir para meu painel</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onSkip} className="flex-1 gap-2">
          <SkipForward className="h-4 w-4" /> Pular
        </Button>
        <Button type="button" onClick={onContinue} className="flex-1 gap-2">
          Concluir <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Você pode adicionar fotos e novos álbuns a qualquer momento em <span className="font-medium">Painel → Portfólio</span>.
      </p>
    </div>
  );
};

export default Step21_PortfolioAlbums;
