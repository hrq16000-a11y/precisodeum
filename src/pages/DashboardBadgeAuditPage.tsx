/**
 * DashboardBadgeAuditPage — Auditoria do badge "Atende no seu bairro".
 *
 * Mostra ao prestador EXATAMENTE quais campos do seu cadastro liberam ou
 * bloqueiam o selo, e o que falta para conquistá-lo. Cada regra tem:
 *  - estado atual (OK / faltando)
 *  - valor coletado do banco
 *  - CTA direto para corrigir
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, MapPin, Navigation, Building2, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardBadgeAuditPage() {
  const { provider } = useAuth();

  useEffect(() => {
    document.title = 'Como o selo "Atende no seu bairro" é calculado';
  }, []);

  const p: any = provider || {};
  const hasCity = !!(p.city && p.city.trim() && p.city !== 'Não informada');
  const hasState = !!(p.state && p.state.trim().length === 2);
  const hasNeighborhood = !!(p.neighborhood && p.neighborhood.trim().length > 0);
  const isUserNeighborhood = p.neighborhood_source === 'user';
  const isAdminFix = p.neighborhood_source === 'admin_fix';
  const isDefaultCentro = p.neighborhood_source === 'default_centro';
  const hasCoords =
    typeof p.latitude === 'number' && typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) && Number.isFinite(p.longitude);

  const rules = [
    {
      key: 'city',
      icon: Building2,
      label: 'Cidade preenchida',
      pass: hasCity && hasState,
      value: hasCity ? `${p.city}/${p.state || '—'}` : 'não informada',
      hint: 'A busca filtra primeiro por cidade exata; sem cidade você não aparece.',
    },
    {
      key: 'neighborhood',
      icon: MapPin,
      label: 'Bairro informado pelo profissional',
      pass: hasNeighborhood && (isUserNeighborhood || isAdminFix),
      value: hasNeighborhood
        ? `${p.neighborhood}${isDefaultCentro ? ' (preenchido automaticamente)' : ''}`
        : 'não informado',
      hint: isDefaultCentro
        ? 'Foi preenchido como "Centro" automaticamente — edite para o bairro real onde você atende.'
        : 'Necessário para o selo "Atende no seu bairro" aparecer no card.',
    },
    {
      key: 'coords',
      icon: Navigation,
      label: 'Coordenadas GPS válidas',
      pass: hasCoords,
      value: hasCoords ? `${p.latitude!.toFixed(4)}, ${p.longitude!.toFixed(4)}` : 'sem coordenadas',
      hint: 'Permite ordenar por proximidade real (Haversine) e exibir distância exata em km.',
    },
  ];

  const allPass = rules.every((r) => r.pass);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <header className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-3 w-3" /> Auditoria do selo
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Como o selo "Atende no seu bairro" é calculado
          </h1>
          <p className="text-sm text-muted-foreground">
            Transparência total: aqui está exatamente o que o sistema verifica no seu cadastro
            para liberar o selo e o ranking de proximidade.
          </p>
        </header>

        {/* Estado geral */}
        <Card className={`p-4 border-2 ${allPass ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${allPass ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
              {allPass ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {allPass ? 'Selo ATIVO no seu perfil' : 'Selo BLOQUEADO — falta completar'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allPass
                  ? 'Você atende todos os critérios. O selo aparece no seu card nas buscas.'
                  : `${rules.filter((r) => !r.pass).length} critério(s) pendente(s).`}
              </p>
              {!allPass && (
                <Button asChild size="sm" className="mt-2 h-9">
                  <Link to="/dashboard/localizacao-guiada">
                    Completar agora <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Lista de regras */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Regras verificadas</h2>
          {rules.map((rule) => {
            const Icon = rule.icon;
            return (
              <Card
                key={rule.key}
                className={`p-4 ${rule.pass ? 'border-emerald-500/30' : 'border-amber-500/30'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    rule.pass ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-700'
                  }`}>
                    {rule.pass ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{rule.label}</p>
                      <Badge variant={rule.pass ? 'default' : 'outline'} className={rule.pass ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' : 'text-amber-700 border-amber-500/40'}>
                        {rule.pass ? <><CheckCircle2 className="mr-1 h-3 w-3" /> liberado</> : <><XCircle className="mr-1 h-3 w-3" /> falta</>}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                      <span className="font-sans not-italic text-[10px] uppercase tracking-wide mr-1">valor:</span>
                      {rule.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{rule.hint}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        {/* Como o sistema decide */}
        <Card className="p-4 bg-muted/30">
          <h3 className="text-sm font-bold text-foreground mb-2">Por que esses critérios?</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• <strong className="text-foreground">Cidade/UF:</strong> a busca prioriza profissionais da mesma cidade do cliente.</li>
            <li>• <strong className="text-foreground">Bairro real:</strong> evitamos exibir o selo para perfis com "Centro" automático — isso protege a confiança do cliente.</li>
            <li>• <strong className="text-foreground">GPS:</strong> sem coordenadas, não conseguimos calcular distância exata nem aplicar ranking de proximidade (Haversine).</li>
            <li>• <strong className="text-foreground">Sem leilão de preço:</strong> o ranking nunca usa valor cobrado — só relevância, qualidade e proximidade.</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
}
