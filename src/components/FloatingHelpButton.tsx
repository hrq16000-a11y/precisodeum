import { useState, forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LifeBuoy, HelpCircle, MessageCircle, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { whatsappLink } from '@/lib/whatsapp';

const FALLBACK_PHONE = '5541997452053';

const FloatingHelpButton = forwardRef<HTMLDivElement>((_, ref) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const supportPhone = useSettingValue('whatsapp_support_phone') || FALLBACK_PHONE;

  // Only show on login, signup, reset-password, dashboard
  const showPaths = ['/login', '/cadastro', '/reset-password', '/dashboard'];
  const shouldShow = showPaths.some(p => location.pathname.startsWith(p));
  if (!shouldShow) return null;

  const options = [
    {
      icon: BookOpen,
      label: 'Central de Ajuda',
      description: 'Guias e tutoriais',
      action: () => { navigate('/ajuda'); setOpen(false); },
    },
    {
      icon: HelpCircle,
      label: 'Perguntas Frequentes',
      description: 'Dúvidas comuns',
      action: () => { navigate('/faq'); setOpen(false); },
    },
    {
      icon: MessageCircle,
      label: 'Falar com Suporte',
      description: 'Via WhatsApp',
      action: () => { window.open(whatsappLink(supportPhone, 'Olá! Preciso de ajuda no Preciso de um.'), '_blank'); setOpen(false); },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9998] bg-foreground/10 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Options panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed right-4 z-[9999] w-64 rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
          >
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-bold text-foreground">Precisa de ajuda?</h3>
              <p className="text-[11px] text-muted-foreground">Estamos aqui para você</p>
            </div>
            <div className="py-1">
              {options.map((opt, i) => (
                <motion.button
                  key={opt.label}
                  onClick={opt.action}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <opt.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen(prev => !prev)}
        className="fixed right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.8 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Ajuda e Suporte"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div key="help" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <LifeBuoy className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
});

FloatingHelpButton.displayName = 'FloatingHelpButton';
export default FloatingHelpButton;
