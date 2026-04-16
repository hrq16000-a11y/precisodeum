import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Camera, MapPin, FileText, Phone, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const SESSION_KEY = 'profile-checkup-dismissed';

interface CheckItem {
  ok: boolean;
  label: string;
  icon: React.ComponentType<any>;
  hint: string;
}

const ProfileCheckupModal = () => {
  const { user, profile, provider } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.profile_type !== 'provider' && profile.profile_type !== 'rh') return;
    if (profile.role === 'admin') return;

    // Only show once per session
    const dismissed = sessionStorage.getItem(SESSION_KEY);
    if (dismissed === '1') return;

    // Check if provider has issues
    const isPending = provider?.status === 'pending';
    const checks = getChecks(profile, provider);
    const incomplete = checks.filter(c => !c.ok).length;

    if (isPending || incomplete >= 2) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, profile, provider]);

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  const handleEdit = () => {
    handleDismiss();
    navigate('/dashboard/perfil');
  };

  if (!profile || !provider) return null;

  const checks = getChecks(profile, provider);
  const completePct = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);
  const isPending = provider?.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 ${isPending ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-blue-50 dark:bg-blue-950/30'}`}>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isPending ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
              }`}
            >
              {isPending
                ? <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                : <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              }
            </motion.div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isPending ? 'Perfil Pendente' : 'Check-up do Perfil'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isPending
                  ? 'Seu perfil está aguardando aprovação'
                  : `${completePct}% completo — vamos melhorar?`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="px-6 py-4 space-y-2">
          {checks.map((check, i) => (
            <motion.div
              key={check.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 rounded-xl p-3 text-sm ${
                check.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
              }`}
            >
              {check.ok
                ? <CheckCircle className="h-4 w-4 shrink-0" />
                : <check.icon className="h-4 w-4 shrink-0" />
              }
              <span className="flex-1 font-medium">{check.ok ? check.label : check.hint}</span>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            Depois
          </Button>
          <Button className="flex-1 gap-2" onClick={handleEdit}>
            Editar Perfil <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function getChecks(profile: any, provider: any): CheckItem[] {
  return [
    {
      ok: !!(provider?.photo_url || profile?.avatar_url),
      label: 'Foto de perfil',
      icon: Camera,
      hint: 'Adicione uma foto de perfil',
    },
    {
      ok: !!(profile?.whatsapp || profile?.phone),
      label: 'Telefone / WhatsApp',
      icon: Phone,
      hint: 'Informe seu telefone ou WhatsApp',
    },
    {
      ok: !!(provider?.city && provider.city !== 'Não informada'),
      label: 'Localização configurada',
      icon: MapPin,
      hint: 'Defina sua cidade e estado',
    },
    {
      ok: !!(provider?.description && provider.description.length >= 30),
      label: 'Descrição completa',
      icon: FileText,
      hint: 'Escreva uma descrição do seu negócio',
    },
    {
      ok: (provider?.services_count ?? 0) > 0,
      label: 'Serviço cadastrado',
      icon: FileText,
      hint: 'Cadastre pelo menos um serviço',
    },
  ];
}

export default ProfileCheckupModal;
