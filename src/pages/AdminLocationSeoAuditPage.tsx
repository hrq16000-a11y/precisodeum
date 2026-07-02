import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCityState, safeUF } from '@/lib/locationFormat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';

type Finding = {
  route: string;
  label: string;
  city: string | null;
  state: string | null;
  expectedDisplay: string;
  ok: boolean;
  reason?: string;
};

const audit = (city: string | null, state: string | null, route: string, label: string): Finding => {
  const uf = safeUF(state);
  const expected = formatCityState(city || '', state || '') || (city || '');
  const issues: string[] = [];
  if (!city) issues.push('cidade ausente');
  if (state && !uf) issues.push(`state inválido: "${state}"`);
  if (city && !uf && state) issues.push('UF não normalizada');
  if (expected.endsWith('-') || expected.endsWith('- ')) issues.push('hífen órfão');
  if (/santa catarina|são paulo|paraná|minas gerais/i.test(expected)) issues.push('nome completo do estado vazando');
  return { route, label, city, state, expectedDisplay: expected || '—', ok: issues.length === 0, reason: issues.join('; ') || undefined };
};

export default function AdminLocationSeoAuditPage() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState({ total: 0, ok: 0, fail: 0 });

  const run = async () => {
    setLoading(true);
    try {
      const all: Finding[] = [];

      const cities = await supabase.from('cities').select('slug, name, uf').limit(200);
      (cities.data || []).forEach((c: any) => {
        all.push(audit(c.name, c.uf, `/cidade/${c.slug}`, `Cidade: ${c.name}`));
      });

      const providers = await supabase
        .from('providers')
        .select('slug, business_name, legal_name, city, state')
        .not('slug', 'is', null)
        .limit(300);
      (providers.data || []).forEach((p: any) => {
        all.push(audit(p.city, p.state, `/profissional/${p.slug}`, `Profissional: ${p.business_name || p.legal_name || p.slug}`));
      });

      setFindings(all);
      const ok = all.filter((f) => f.ok).length;
      setSummary({ total: all.length, ok, fail: all.length - ok });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) run(); }, [isAdmin]);

  const failing = findings.filter((f) => !f.ok);

  if (adminLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando permissões…
        </div>
      </AdminLayout>
    );
  }
  if (!isAdmin) return null;

  return (
    <AdminLayout>
    <div className="container mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Auditoria SEO — Cidade – UF</h1>
          <p className="text-sm text-muted-foreground">
            Confere /cidade/&#123;slug&#125; e /profissional/&#123;slug&#125; para garantir título e JSON-LD com "Cidade – UF" coerente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Rodar novamente
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Rotas auditadas</div><div className="text-2xl font-bold">{summary.total}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">OK</div><div className="text-2xl font-bold text-emerald-600">{summary.ok}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Com problema</div><div className="text-2xl font-bold text-destructive">{summary.fail}</div></Card>
      </div>

      {failing.length > 0 && (
        <Card className="p-3">
          <h2 className="mb-2 text-sm font-semibold text-destructive">Rotas com problema ({failing.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-2 py-1.5">Rota</th>
                  <th className="px-2 py-1.5">Label</th>
                  <th className="px-2 py-1.5">city</th>
                  <th className="px-2 py-1.5">state</th>
                  <th className="px-2 py-1.5">Display esperado</th>
                  <th className="px-2 py-1.5">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {failing.slice(0, 200).map((f) => (
                  <tr key={f.route} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">
                      <a href={f.route} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {f.route} <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-2 py-1.5">{f.label}</td>
                    <td className="px-2 py-1.5">{f.city || '∅'}</td>
                    <td className="px-2 py-1.5">{f.state || '∅'}</td>
                    <td className="px-2 py-1.5">{f.expectedDisplay}</td>
                    <td className="px-2 py-1.5 text-destructive"><AlertTriangle className="mr-1 inline h-3 w-3" />{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {failing.length === 0 && !loading && (
        <Card className="flex items-center gap-2 p-4 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Tudo certo: todas as rotas exibem "Cidade – UF" corretamente.
        </Card>
      )}
    </div>
    </AdminLayout>
  );
}
