import { Camera, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface AvatarReminderProps {
  avatarUrl?: string | null;
}

const AvatarReminder = ({ avatarUrl }: AvatarReminderProps) => {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Only show if avatar is missing or is a generated placeholder
  const isPlaceholder = !avatarUrl || avatarUrl.includes('ui-avatars.com');
  if (!isPlaceholder || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Camera className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Adicione sua foto de perfil!</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Profissionais com foto recebem até 3x mais contatos.
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          className="shrink-0"
          onClick={() => navigate('/dashboard/perfil')}
        >
          <Camera className="mr-1 h-3.5 w-3.5" />
          Adicionar
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default AvatarReminder;
