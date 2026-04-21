import { useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Settings = {
  title: string;
  subtitle: string;
  card1_icon: string; card1_title: string; card1_description: string; card1_profile_type: string;
  card2_icon: string; card2_title: string; card2_description: string; card2_profile_type: string;
  card3_icon: string; card3_title: string; card3_description: string; card3_profile_type: string;
};

const FALLBACK: Settings = {
  title: 'Bem-vindo! Como você quer usar a plataforma?',
  subtitle: 'Escolha o perfil que melhor descreve você. Você pode mudar depois.',
  card1_icon: 'Briefcase', card1_title: 'Sou Profissional', card1_description: 'Quero divulgar meus serviços e receber clientes.', card1_profile_type: 'provider',
  card2_icon: 'Users', card2_title: 'Quero Contratar', card2_description: 'Procuro profissionais qualificados para um serviço.', card2_profile_type: 'client',
  card3_icon: 'User', card3_title: 'Sou Cliente', card3_description: 'Quero salvar meus profissionais favoritos e acompanhar contatos.', card3_profile_type: 'client',
};

const ACCENTS = [
  { ring: 'hover:border-accent', bg: 'bg-accent/10', text: 'text-accent' },
  { ring: 'hover:border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-600' },
  { ring: 'hover:border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-600' },
];

export default function WelcomeOnboardingModal() {
  const { user, profile, refetchProfile } = useAuth();
  const [settings, setSettings] = useState<Settings>(FALLBACK);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const open = !!user && !!profile && profile.onboarding_completed === false;

  useEffect(() => {
    if (!open) return;
    supabase.from('onboarding_settings' as any).select('*').eq('active', true).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setSettings(data as any); });
  }, [open]);

  const choose = async (profileType: string) => {
    if (!user) return;
    // Blindagem: signup público nunca pode gravar 'rh'. Apenas admin atribui esse tipo.
    const safeType = profileType === 'rh' ? 'client' : profileType;
    setSubmitting(safeType);
    const { error } = await supabase.from('profiles').update({
      profile_type: safeType,
      role: safeType,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    } as any).eq('id', user.id);
    setSubmitting(null);
    if (error) {
      toast.error('Não foi possível salvar sua escolha. Tente novamente.');
      return;
    }
    toast.success('Tudo certo! Bem-vindo(a)!');
    await refetchProfile();
  };

  const cards = [
    { icon: settings.card1_icon, title: settings.card1_title, desc: settings.card1_description, type: settings.card1_profile_type, accent: ACCENTS[0] },
    { icon: settings.card2_icon, title: settings.card2_title, desc: settings.card2_description, type: settings.card2_profile_type, accent: ACCENTS[1] },
    { icon: settings.card3_icon, title: settings.card3_title, desc: settings.card3_description, type: settings.card3_profile_type, accent: ACCENTS[2] },
  ];

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-0 [&>button]:hidden animate-in fade-in-0 zoom-in-95 duration-300"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-8"
        >
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground text-center">{settings.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">{settings.subtitle}</p>
          </motion.div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <AnimatePresence>
              {cards.map((c, i) => {
                const Icon = (Lucide as any)[c.icon] || Lucide.Sparkles;
                const isSubmitting = submitting === c.type;
                const disabled = !!submitting;
                return (
                  <motion.button
                    key={c.type + i}
                    type="button"
                    onClick={() => choose(c.type)}
                    disabled={disabled}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 border-border bg-card/80 p-4 text-left transition-all duration-200 ${c.accent.ring} hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.accent.bg} ${c.accent.text}`}>
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{c.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Sua escolha personaliza sua experiência. Você pode alterar nas configurações depois.
          </p>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
