import { useState } from 'react';
import { User, Briefcase, Building2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TYPES = [
  {
    value: 'client',
    label: 'Cliente',
    icon: User,
    desc: 'Busco profissionais e serviços',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    selectedColor: 'bg-blue-500 text-white border-blue-500',
  },
  {
    value: 'provider',
    label: 'Profissional',
    icon: Briefcase,
    desc: 'Ofereço serviços e quero clientes',
    color: 'bg-accent/10 text-accent border-accent/30',
    selectedColor: 'bg-accent text-accent-foreground border-accent',
  },
  {
    value: 'rh',
    label: 'Agência / RH',
    icon: Building2,
    desc: 'Publico vagas e recruto profissionais',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    selectedColor: 'bg-purple-600 text-white border-purple-600',
  },
];

/**
 * Full-screen overlay shown when a user (typically from social login)
 * has no profile_type chosen yet (defaults to 'client' with no explicit choice).
 * This component blocks navigation until a type is explicitly selected.
 */
const ProfileTypeChooser = () => {
  const { user, refetchProfile } = useAuth();
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleConfirm = async () => {
    if (!user || !selected) return;
    setSaving(true);
    try {
      const profileRole = selected === 'rh' ? 'client' : selected;
      const [profileRes, metaRes] = await Promise.all([
        supabase
          .from('profiles')
          .update({ profile_type: selected, role: profileRole } as any)
          .eq('id', user.id),
        supabase.auth.updateUser({
          data: { profile_type_chosen: true },
        }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (metaRes.error) throw metaRes.error;

      // If provider, create provider record
      if (selected === 'provider') {
        const { data: existing } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (!existing || existing.length === 0) {
          const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'profissional';
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          await supabase.from('providers').insert({
            user_id: user.id,
            slug,
            status: 'pending',
          });
        }
      }

      await refetchProfile();
      toast.success(`Conta configurada como ${TYPES.find(t => t.value === selected)?.label}`);

      // Redirect based on type
      if (selected === 'client') {
        navigate('/', { replace: true });
      } else if (selected === 'rh') {
        navigate('/dashboard/vagas', { replace: true });
      } else {
        navigate('/dashboard/servicos', { replace: true });
      }
    } catch {
      toast.error('Erro ao configurar conta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-center font-display text-xl font-bold text-foreground">
          Bem-vindo! Escolha seu tipo de conta
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Selecione como você deseja usar a plataforma. Você pode alterar depois.
        </p>

        <div className="mt-6 space-y-3">
          {TYPES.map(type => {
            const Icon = type.icon;
            const isActive = selected === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setSelected(type.value)}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                  isActive ? type.selectedColor + ' shadow-md' : type.color + ' hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold">{type.label}</h3>
                    <p className={`text-xs mt-0.5 ${isActive ? 'opacity-90' : 'text-muted-foreground'}`}>
                      {type.desc}
                    </p>
                  </div>
                  {isActive && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="accent"
          className="mt-6 w-full"
          disabled={!selected || saving}
          onClick={handleConfirm}
        >
          {saving ? 'Configurando...' : 'Confirmar e continuar'}
        </Button>
      </div>
    </div>
  );
};

export default ProfileTypeChooser;
