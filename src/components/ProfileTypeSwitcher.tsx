import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const TYPES = [
  { value: 'client', label: 'Cliente', icon: User, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'provider', label: 'Profissional', icon: Briefcase, color: 'border-accent/40 bg-accent/10 text-accent' },
  { value: 'rh', label: 'Agência / RH', icon: Building2, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
];

const ProfileTypeSwitcher = () => {
  const { user, profile, refetchProfile } = useAuth();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const currentType = profile?.profile_type || 'client';

  const handleSwitch = async (newType: string) => {
    if (!user || newType === currentType || switching) return;
    setSwitching(true);
    try {
      const profileRole = newType === 'rh' ? 'client' : newType;
      const { error } = await supabase
        .from('profiles')
        .update({ profile_type: newType, role: profileRole } as any)
        .eq('id', user.id);
      if (error) throw error;

      // If switching to provider, ensure provider record exists
      if (newType === 'provider') {
        const { data: existing } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (!existing || existing.length === 0) {
          const name = profile?.full_name || user.email?.split('@')[0] || 'profissional';
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          await supabase.from('providers').insert({
            user_id: user.id,
            slug,
            status: 'pending',
          });
        }
      }

      await refetchProfile();
      const label = TYPES.find(t => t.value === newType)?.label;
      toast.success(`Conta alterada para ${label}`);

      // Redirect to the correct area immediately
      if (newType === 'client') {
        navigate('/dashboard', { replace: true });
      } else if (newType === 'rh') {
        navigate('/dashboard/vagas', { replace: true });
      } else {
        navigate('/dashboard/servicos', { replace: true });
      }
    } catch {
      toast.error('Erro ao alterar tipo de conta');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-bold text-foreground mb-1">Tipo de Conta</h3>
      <p className="text-xs text-muted-foreground mb-3">Altere o tipo da sua conta a qualquer momento</p>
      <div className="flex flex-wrap gap-2">
        {TYPES.map(t => {
          const Icon = t.icon;
          const isActive = currentType === t.value;
          return (
            <button
              key={t.value}
              disabled={switching}
              onClick={() => handleSwitch(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                isActive ? t.color + ' shadow-sm' : 'border-border text-muted-foreground hover:border-muted-foreground/30'
              } ${switching ? 'opacity-50' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {isActive && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileTypeSwitcher;
