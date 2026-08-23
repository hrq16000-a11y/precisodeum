import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Shuffle, CalendarDays, Lock, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type Strategy = 'daily' | 'session' | 'fixed';

const STRATEGY_OPTIONS: Array<{
  value: Strategy;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'daily',
    title: 'Diária por cidade (recomendado)',
    description:
      'Mesma ordem para todos os visitantes da mesma cidade durante o dia. Muda automaticamente a cada 24h. Ideal para manter previsibilidade e cache.',
    icon: CalendarDays,
  },
  {
    value: 'session',
    title: 'Por sessão (aleatória a cada visita)',
    description:
      'Cada nova sessão do navegador vê uma ordem diferente. Maior fairness — todos os profissionais ganham visibilidade ao longo do tempo.',
    icon: Shuffle,
  },
  {
    value: 'fixed',
    title: 'Fixa (sem rotação)',
    description:
      'Sem embaralhamento. Categorias aparecem na ordem alfabética/oficial vinda do banco. Útil para depuração ou compliance.',
    icon: Lock,
  },
];

const SETTING_KEY = 'home_categories_rotation_strategy';

export default function AdminHomeRotationPage() {
  const { isAdmin, loading } = useAdmin();
  const qc = useQueryClient();
  const [current, setCurrent] = useState<Strategy>('daily');
  const [draft, setDraft] = useState<Strategy>('daily');
  const [loadingValue, setLoadingValue] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('site_settings' as any)
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      if (!active) return;
      const value = (data as any)?.value;
      const parsed: Strategy =
        value === 'session' || value === 'fixed' ? value : 'daily';
      setCurrent(parsed);
      setDraft(parsed);
      setLoadingValue(false);
    })();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)('update_site_setting_audited', {
      p_key: SETTING_KEY,
      p_value: draft,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    setCurrent(draft);
    toast.success('Estratégia atualizada — aplicando em tempo real');
    // Invalida settings para que CategoriesGrid leia o novo valor sem reload.
    qc.invalidateQueries({ queryKey: ['site-settings'] });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <p className="p-6 text-muted-foreground">Acesso restrito.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <header className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Home — Rotação
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Estratégia de rotação das Categorias
          </h1>
          <p className="text-sm text-muted-foreground">
            Define como a grade de <strong>Categorias</strong> da home é embaralhada.
            Aplicado em tempo real (sem redeploy).
          </p>
        </header>

        <Card className="border-border bg-card p-4 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="space-y-1">
              <p>
                A seção de <strong>Profissionais em Destaque</strong> usa lógica fixa
                (Local → Ranking/Completude → Aleatório por sessão para empates) e
                não depende desta configuração.
              </p>
              <p>
                Para ocultar/reordenar seções inteiras, use{' '}
                <a className="text-accent underline" href="/admin/secoes-home">
                  Ordem das Seções
                </a>
                .
              </p>
            </div>
          </div>
        </Card>

        {loadingValue ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RadioGroup
            value={draft}
            onValueChange={(v) => setDraft(v as Strategy)}
            className="space-y-3"
          >
            {STRATEGY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = draft === opt.value;
              return (
                <Label
                  key={opt.value}
                  htmlFor={`strategy-${opt.value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                    active
                      ? 'border-accent bg-accent/5 shadow-xs'
                      : 'border-border bg-card hover:border-accent/40'
                  }`}
                >
                  <RadioGroupItem
                    id={`strategy-${opt.value}`}
                    value={opt.value}
                    className="mt-1"
                  />
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      active ? 'text-accent' : 'text-muted-foreground'
                    }`}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {opt.title}
                      </span>
                      {current === opt.value && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                          Em uso
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft(current)}
            disabled={saving || draft === current}
          >
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || draft === current}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Salvar e aplicar
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
