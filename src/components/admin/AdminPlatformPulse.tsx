import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, MessageSquare, Star, Briefcase, Radio, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PulseEvent {
  id: string;
  type: 'signup' | 'lead' | 'review' | 'provider' | 'job';
  message: string;
  time: string;
}

const typeConfig = {
  signup: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
  lead: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10', ring: 'ring-purple-500/20' },
  review: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
  provider: { icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  job: { icon: Megaphone, color: 'text-indigo-500', bg: 'bg-indigo-500/10', ring: 'ring-indigo-500/20' },
};

const AdminPlatformPulse = () => {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecent = async () => {
      const [profiles, leads, reviews, providers, jobs] = await Promise.all([
        supabase.from('profiles').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('leads').select('id, client_name, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('reviews').select('id, rating, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('providers').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('jobs').select('id, title, created_at').order('created_at', { ascending: false }).limit(3),
      ]);

      const allEvents: PulseEvent[] = [
        ...(profiles.data || []).map((p: any) => ({
          id: `p-${p.id}`, type: 'signup' as const,
          message: `${p.full_name || 'Novo usuário'} se cadastrou`,
          time: p.created_at,
        })),
        ...(leads.data || []).map((l: any) => ({
          id: `l-${l.id}`, type: 'lead' as const,
          message: `Lead de ${l.client_name}`,
          time: l.created_at,
        })),
        ...(reviews.data || []).map((r: any) => ({
          id: `r-${r.id}`, type: 'review' as const,
          message: `Nova avaliação ★${r.rating}`,
          time: r.created_at,
        })),
        ...(providers.data || []).map((pr: any) => ({
          id: `pr-${pr.id}`, type: 'provider' as const,
          message: `${pr.business_name || 'Prestador'} cadastrado`,
          time: pr.created_at,
        })),
        ...(jobs.data || []).map((j: any) => ({
          id: `j-${j.id}`, type: 'job' as const,
          message: `Vaga: ${j.title}`,
          time: j.created_at,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);

      setEvents(allEvents);
      setLoading(false);
    };

    fetchRecent();
  }, []);

  if (loading || events.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
          <Radio className="h-4 w-4 text-accent" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
          </span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Pulso da Plataforma</h3>
          <p className="text-[10px] text-muted-foreground">Atividade recente em tempo real</p>
        </div>
      </div>

      <div ref={scrollRef} className="space-y-1.5 max-h-64 overflow-y-auto overscroll-contain pr-1">
        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const config = typeConfig[event.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -16, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ring-1 ${config.ring} ${config.bg} transition-colors`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                  <Icon className={`h-3 w-3 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{event.message}</p>
                </div>
                <span className="text-[9px] text-muted-foreground/60 shrink-0">
                  {formatDistanceToNow(new Date(event.time), { addSuffix: true, locale: ptBR })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminPlatformPulse;
