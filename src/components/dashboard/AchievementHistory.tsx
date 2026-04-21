import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Briefcase, Image as ImageIcon, User, Sparkles, Star, ExternalLink, Share2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logAuditAction } from '@/hooks/useAuditLog';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

interface Achievement {
  id: string;
  title: string;
  date: string;
  icon: typeof Trophy;
  cls: string;
}

const ACTION_MAP: Record<string, { title: string; icon: typeof Trophy; cls: string }> = {
  service_create_atomic: { title: 'Serviço cadastrado', icon: Briefcase, cls: 'text-blue-600 bg-blue-500/10' },
  album_create_atomic: { title: 'Álbum criado', icon: ImageIcon, cls: 'text-pink-600 bg-pink-500/10' },
  portfolio_photo_atomic: { title: 'Foto adicionada ao portfólio', icon: ImageIcon, cls: 'text-pink-600 bg-pink-500/10' },
  profile_update: { title: 'Perfil atualizado', icon: User, cls: 'text-emerald-600 bg-emerald-500/10' },
  level_up: { title: 'Novo nível alcançado', icon: Star, cls: 'text-amber-600 bg-amber-500/10' },
};

const buildShareUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

const buildAchievementSvg = (levelName: string, profileUrl: string) => {
  const safeLevel = levelName.replace(/[<>&]/g, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#155e75"/></linearGradient>
        <linearGradient id="seal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fef3c7"/><stop offset="0.45" stop-color="#67e8f9"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
      </defs>
      <rect width="1080" height="1080" rx="72" fill="url(#bg)"/>
      <circle cx="540" cy="390" r="190" fill="url(#seal)" opacity="0.95"/>
      <circle cx="540" cy="390" r="144" fill="#0f172a" opacity="0.92"/>
      <path d="M540 268l39 82 90 13-65 64 15 89-79-42-80 42 16-89-66-64 91-13 39-82z" fill="#f8fafc"/>
      <text x="540" y="680" text-anchor="middle" fill="#f8fafc" font-family="Arial, sans-serif" font-size="54" font-weight="700">Profissional ${safeLevel}</text>
      <text x="540" y="748" text-anchor="middle" fill="#bae6fd" font-family="Arial, sans-serif" font-size="32">Selo de Elite no Preciso de Um</text>
      <text x="540" y="830" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="24">${profileUrl}</text>
    </svg>
  `)}`;
};

/**
 * AchievementHistory — "Mural de Conquistas".
 * Lists the user's last 5 wins so they SEE the platform recording their effort.
 */
interface AchievementHistoryProps {
  providerSlug?: string | null;
  levelName?: string | null;
}

const AchievementHistory = ({ providerSlug, levelName }: AchievementHistoryProps = {}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      // Fetch a slightly larger window so we can dedupe and still show 5 unique wins.
      const { data } = await supabase
        .from('audit_log')
        .select('id, action, created_at, details, resource_id, resource_type')
        .eq('user_id', user.id)
        .in('action', Object.keys(ACTION_MAP))
        .order('created_at', { ascending: false })
        .limit(25);

      // Dedupe by (action + resource_id) so a double-save from a flaky connection
      // doesn't show as two trophies. Keep the most recent one.
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const row of data || []) {
        const key = `${row.action}:${row.resource_id ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
        if (deduped.length >= 5) break;
      }

      const mapped = deduped.map((row: any) => {
        const meta = ACTION_MAP[row.action] || { title: row.action, icon: Trophy, cls: 'text-muted-foreground bg-muted' };
        return {
          id: row.id,
          title: meta.title,
          date: row.created_at,
          icon: meta.icon,
          cls: meta.cls,
        } as Achievement;
      });
      setItems(mapped);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || items.length === 0) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const profileUrl = providerSlug ? `${SITE_BASE_URL}/profissional/${providerSlug}` : '';
  const shareMessage = levelName
    ? `Confira meu selo de Profissional ${levelName} no Preciso de Um! ${profileUrl}`
    : `Confira meu perfil profissional no Preciso de Um! ${profileUrl}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-600">
          <Trophy className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            Mural de Conquistas
            <Sparkles className="h-3 w-3 text-amber-500" />
          </h3>
          <p className="text-[11px] text-muted-foreground">Suas últimas vitórias na plataforma</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${item.cls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="flex-1 text-xs font-medium text-foreground truncate">{item.title}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(item.date)}</span>
            </motion.li>
          );
        })}
      </ul>

      {providerSlug && (
        <>
          <a
            href={`/profissional/${providerSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={async () => {
              try {
                if (user?.id) {
                  const { data: prov } = await supabase
                    .from('providers')
                    .select('id, category_id, categories(slug, name)')
                    .eq('user_id', user.id)
                    .maybeSingle();
                  void logAuditAction({
                    action: 'next_step_chosen',
                    resource_type: 'public_profile_preview',
                    resource_id: prov?.id ?? undefined,
                    details: {
                      source: 'achievement_history',
                      category_slug: (prov?.categories as any)?.slug ?? null,
                      category_name: (prov?.categories as any)?.name ?? null,
                      slug: providerSlug,
                    },
                  });
                }
              } catch {
                /* tracking is best-effort */
              }
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 px-3 py-2 text-xs font-bold text-primary transition hover:border-primary/60 hover:from-primary/20 hover:to-accent/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ver como o cliente me vê
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>

          {/* Share level on WhatsApp — pride amplifier (Selo de Elite) */}
          <a
            href={buildShareUrl(shareMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void logAuditAction({
                action: 'level_share',
                resource_type: 'achievement_history',
                details: {
                  channel: 'whatsapp',
                  level_name: levelName ?? null,
                  slug: providerSlug,
                },
              });
            }}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs font-bold text-success transition hover:border-success/60 hover:bg-success/10"
          >
            <Share2 className="h-3.5 w-3.5" />
            {levelName ? `Compartilhar meu Nivel ${levelName}` : 'Compartilhar meu Nivel'}
          </a>

          {levelName && (
            <a
              href={buildAchievementSvg(levelName, profileUrl)}
              download={`selo-${levelName.toLowerCase()}-preciso-de-um.svg`}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Card de Conquista
            </a>
          )}
        </>
      )}
    </div>
  );
};

export default AchievementHistory;
