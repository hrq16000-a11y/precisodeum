import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Briefcase, Building2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProfileTypeInfo {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tierKey: string;
  color: string;
}

const PROFILE_TYPES: ProfileTypeInfo[] = [
  { key: 'client', label: 'Cliente', description: 'Busca profissionais e serviços. Não pode criar serviços.', icon: <User className="h-5 w-5" />, tierKey: 'free_client', color: '#3b82f6' },
  { key: 'provider', label: 'Profissional', description: 'Oferece serviços, recebe leads e aparece nas buscas.', icon: <Briefcase className="h-5 w-5" />, tierKey: 'free_provider', color: '#10b981' },
  { key: 'rh', label: 'Agência / RH', description: 'Publica vagas e gerencia oportunidades de trabalho.', icon: <Building2 className="h-5 w-5" />, tierKey: 'free_rh', color: '#8b5cf6' },
];

const ProfileTypesTab = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tierRules, setTierRules] = useState<Record<string, any>>({});
  const [accountTypes, setAccountTypes] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: profiles }, { data: tiers }, { data: acTypes }] = await Promise.all([
        supabase.from('profiles').select('profile_type'),
        supabase.from('tier_rules' as any).select('*'),
        supabase.from('account_types').select('id, name, color'),
      ]);

      const c: Record<string, number> = {};
      (profiles || []).forEach((p: any) => {
        c[p.profile_type] = (c[p.profile_type] || 0) + 1;
      });
      setCounts(c);

      const t: Record<string, any> = {};
      (tiers || []).forEach((r: any) => { t[r.tier_key] = r; });
      setTierRules(t);

      setAccountTypes(acTypes || []);
    };
    fetch();
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {total} usuário(s) cadastrado(s) em 3 tipos de cadastro. Cada tipo possui regras de tier associadas.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {PROFILE_TYPES.map(pt => {
          const tier = tierRules[pt.tierKey];
          const count = counts[pt.key] || 0;
          return (
            <Card key={pt.key} className="relative overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: pt.color }} />
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: pt.color }}>
                    {pt.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground text-lg">{pt.label}</h3>
                    <span className="text-xs text-muted-foreground font-mono">profile_type: {pt.key}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{pt.description}</p>

                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{count}</span>
                  <span className="text-xs text-muted-foreground">usuário(s)</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {total > 0 ? Math.round((count / total) * 100) : 0}%
                  </span>
                </div>

                {tier && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                      Regra de Tier: <Badge variant="outline" className="text-[10px] font-mono">{tier.tier_key}</Badge>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Máx. Serviços: <strong className="text-foreground">{tier.max_services === -1 ? '∞' : tier.max_services}</strong></div>
                      <div>Máx. Leads: <strong className="text-foreground">{tier.max_leads === -1 ? '∞' : tier.max_leads}</strong></div>
                      <div>Criar serviços: <Badge variant={tier.can_create_services ? 'default' : 'secondary'} className="text-[10px]">{tier.can_create_services ? 'Sim' : 'Não'}</Badge></div>
                      <div>Receber leads: <Badge variant={tier.can_receive_leads ? 'default' : 'secondary'} className="text-[10px]">{tier.can_receive_leads ? 'Sim' : 'Não'}</Badge></div>
                    </div>
                  </div>
                )}

                {!tier && (
                  <div className="rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs text-muted-foreground italic">Nenhuma regra de tier associada ({pt.tierKey})</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary of account plans */}
      <div className="mt-8">
        <h3 className="font-display font-bold text-foreground mb-3">Planos de Assinatura Disponíveis</h3>
        <p className="text-xs text-muted-foreground mb-3">Estes planos são atribuídos via aba "Tipos de Conta" e aplicam-se a qualquer tipo de cadastro.</p>
        <div className="flex flex-wrap gap-2">
          {accountTypes.map(at => (
            <Badge key={at.id} variant="outline" className="text-sm px-3 py-1" style={{ borderColor: at.color, color: at.color }}>
              {at.name}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
};

export default ProfileTypesTab;
