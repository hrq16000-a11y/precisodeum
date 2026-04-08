import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Briefcase, Building2, Users, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProfileTypeInfo {
  key: string;
  label: string;
  role: string;
  description: string;
  icon: React.ReactNode;
  tierKey: string;
  color: string;
  capabilities: { label: string; enabled: boolean }[];
}

const PROFILE_TYPES: ProfileTypeInfo[] = [
  {
    key: 'client',
    label: 'Cliente',
    role: 'client',
    description: 'Busca profissionais, solicita orçamentos. NÃO publica serviços nem vagas.',
    icon: <User className="h-5 w-5" />,
    tierKey: 'free_client',
    color: '#3b82f6',
    capabilities: [
      { label: 'Buscar profissionais', enabled: true },
      { label: 'Solicitar orçamentos', enabled: true },
      { label: 'Ver perfis e avaliações', enabled: true },
      { label: 'Avaliar profissionais', enabled: true },
      { label: 'Cadastrar serviços', enabled: false },
      { label: 'Receber leads', enabled: false },
      { label: 'Publicar vagas', enabled: false },
      { label: 'Página profissional', enabled: false },
    ],
  },
  {
    key: 'provider',
    label: 'Profissional',
    role: 'provider',
    description: 'Página profissional, cadastra serviços, recebe leads e publica vagas.',
    icon: <Briefcase className="h-5 w-5" />,
    tierKey: 'free_provider',
    color: '#10b981',
    capabilities: [
      { label: 'Página profissional', enabled: true },
      { label: 'Cadastrar serviços', enabled: true },
      { label: 'Receber leads', enabled: true },
      { label: 'Publicar vagas', enabled: true },
      { label: 'Portfólio de trabalhos', enabled: true },
      { label: 'Aparecer nas buscas', enabled: true },
      { label: 'Estatísticas de perfil', enabled: true },
      { label: 'Personalizar página', enabled: true },
    ],
  },
  {
    key: 'rh',
    label: 'Agência / RH',
    role: 'client',
    description: 'Publica vagas, recruta profissionais. NÃO cadastra serviços.',
    icon: <Building2 className="h-5 w-5" />,
    tierKey: 'free_rh',
    color: '#8b5cf6',
    capabilities: [
      { label: 'Publicar vagas', enabled: true },
      { label: 'Recrutar profissionais', enabled: true },
      { label: 'Buscar profissionais', enabled: true },
      { label: 'Gerenciar candidatos', enabled: true },
      { label: 'Cadastrar serviços', enabled: false },
      { label: 'Receber leads', enabled: false },
      { label: 'Página profissional', enabled: false },
      { label: 'Aparecer nas buscas', enabled: false },
    ],
  },
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
          {total} usuário(s) em 3 tipos de cadastro. Cada tipo possui permissões, regras de tier e recursos específicos.
        </p>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        {PROFILE_TYPES.map(pt => {
          const tier = tierRules[pt.tierKey];
          const count = counts[pt.key] || 0;
          return (
            <Card key={pt.key} className="relative overflow-hidden">
              <div className="h-2" style={{ backgroundColor: pt.color }} />
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: pt.color }}>
                    {pt.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-foreground text-lg">{pt.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">profile_type: {pt.key}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">role: {pt.role}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">{pt.description}</p>

                {/* User count */}
                <div className="flex items-center gap-2 mb-4 bg-muted/40 rounded-lg px-3 py-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">{count}</span>
                  <span className="text-xs text-muted-foreground">usuário(s)</span>
                  <span className="text-xs text-muted-foreground ml-auto font-semibold">
                    {total > 0 ? Math.round((count / total) * 100) : 0}%
                  </span>
                </div>

                {/* Capabilities */}
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">Permissões do Tipo</h4>
                  <div className="space-y-1">
                    {pt.capabilities.map(cap => (
                      <div key={cap.label} className="flex items-center gap-2 text-xs">
                        {cap.enabled ? (
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className={cap.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}>{cap.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tier rules */}
                {tier && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                      Regra de Tier <Badge variant="outline" className="text-[10px] font-mono ml-1">{tier.tier_key}</Badge>
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
                    <p className="text-xs text-muted-foreground italic">Sem regra de tier ({pt.tierKey})</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Account plans summary */}
      <div className="mt-8">
        <h3 className="font-display font-bold text-foreground mb-2">Planos de Assinatura</h3>
        <p className="text-xs text-muted-foreground mb-3">Estes planos aplicam-se a qualquer tipo de cadastro e são gerenciados na aba "Planos".</p>
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
