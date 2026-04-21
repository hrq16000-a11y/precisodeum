import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  sponsorId: string;
  currentStatus?: string | null;
  lastViewedStatus?: string | null;
  slotName?: string | null;
  userRef?: string | null;
}

function fireConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ['#f97316', '#fbbf24', '#10b981', '#3b82f6', '#a855f7'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  // initial burst
  confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors });
}

const SponsorApprovalCelebration = ({
  sponsorId,
  currentStatus,
  lastViewedStatus,
  slotName,
  userRef,
}: Props) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!sponsorId) return;
    const justApproved =
      currentStatus === 'active' &&
      lastViewedStatus !== 'active' &&
      (lastViewedStatus === 'pending_approval' || lastViewedStatus === null || lastViewedStatus === undefined);

    if (!justApproved) return;

    setShow(true);
    fireConfetti();

    // Persist so the celebration only fires once
    supabase
      .from('sponsors')
      .update({ last_viewed_status: 'active' })
      .eq('id', sponsorId)
      .then(() => {
        // best-effort audit
        if (userRef) {
          supabase.from('audit_log').insert({
            user_id: userRef,
            action: 'sponsor.celebration.viewed',
            resource_type: 'sponsor',
            resource_id: sponsorId,
            details: { slot: slotName ?? null },
          } as any);
        }
      });
  }, [sponsorId, currentStatus, lastViewedStatus, slotName, userRef]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          className="relative overflow-hidden rounded-2xl border border-primary/30 p-5 sm:p-6 shadow-lg"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at top left, hsl(var(--primary) / 0.18), transparent 60%),
              radial-gradient(ellipse at bottom right, hsl(var(--accent) / 0.18), transparent 60%),
              linear-gradient(135deg, hsl(var(--card)), hsl(var(--card)))
            `,
          }}
        >
          {/* Shimmer */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
            style={{
              background:
                'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.18), transparent)',
            }}
            animate={{ x: ['0%', '450%'] }}
            transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.5 }}
          />

          <button
            onClick={() => setShow(false)}
            aria-label="Fechar"
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 220 }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-md"
            >
              <Sparkles className="h-7 w-7 text-white" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Parabéns! Sua marca já está brilhando no Preciso de Um!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {slotName
                  ? <>O seu anúncio no slot <strong className="text-foreground">{slotName}</strong> foi aprovado e já está a gerar impressões em tempo real.</>
                  : 'Seu anúncio foi aprovado e já está a gerar impressões em tempo real.'}
              </p>
            </div>

            <Button asChild size="sm" className="shrink-0 gap-2 shadow-sm">
              <Link to="/sponsor-panel/metricas">
                <BarChart3 className="h-4 w-4" />
                Ver estatísticas agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SponsorApprovalCelebration;
