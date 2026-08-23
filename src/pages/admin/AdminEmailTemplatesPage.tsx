/**
 * AdminEmailTemplatesPage — edição e preview dos templates de e-mail (Resend)
 * + status de entrega/erro registrado pelo webhook em `email_events`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Plus, RefreshCcw, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AsyncBoundary, SkeletonCardGrid } from '@/components/motion';
import { useSeoHead } from '@/hooks/useSeoHead';

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  enabled: boolean;
  updated_at: string;
}

interface EmailEvent {
  id: string;
  event_type: string;
  recipient: string | null;
  subject: string | null;
  template: string | null;
  occurred_at: string;
}

const EVENT_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'email.delivered': 'outline',
  'email.sent': 'secondary',
  'email.bounced': 'destructive',
  'email.complained': 'destructive',
  'email.delivery_delayed': 'destructive',
};

const AdminEmailTemplatesPage = () => {
  useSeoHead({
    title: 'Templates de e-mail · Admin',
    description: 'Edição e preview dos templates de e-mail transacional.',
    noindex: true,
  });

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<EmailTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpl, evt] = await Promise.all([
        supabase.from('email_templates' as any).select('*').order('name'),
        supabase
          .from('email_events' as any)
          .select('id, event_type, recipient, subject, template, occurred_at')
          .order('occurred_at', { ascending: false })
          .limit(50),
      ]);
      if (tpl.error) throw tpl.error;
      const rows = (tpl.data || []) as unknown as EmailTemplate[];
      setTemplates(rows);
      setEvents(((evt.data || []) as unknown as EmailEvent[]) ?? []);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    setDraft(selected ? { ...selected } : {});
  }, [selected]);

  const save = useCallback(async () => {
    if (!draft.key || !draft.subject) {
      toast.error('Chave e assunto são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        key: draft.key,
        name: draft.name || draft.key,
        subject: draft.subject,
        html: draft.html || '',
        enabled: draft.enabled ?? true,
      };
      const { error: err } = draft.id
        ? await supabase.from('email_templates' as any).update(payload).eq('id', draft.id)
        : await supabase.from('email_templates' as any).insert(payload);
      if (err) throw err;
      toast.success('Template salvo.');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar template');
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const startNew = () => {
    setSelectedId(null);
    setDraft({ key: '', name: '', subject: '', html: '<p>Olá {{nome}},</p>', enabled: true });
  };

  return (
    <main className="container mx-auto space-y-6 px-4 py-6 motion-enter">
      <header className="flex flex-wrap items-center gap-3">
        <Mail className="h-5 w-5 text-accent" aria-hidden />
        <h1 className="text-2xl font-bold">Templates de e-mail</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden /> Atualizar
          </Button>
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Novo
          </Button>
        </div>
      </header>

      <AsyncBoundary
        loading={loading}
        error={error}
        skeleton={<SkeletonCardGrid count={3} />}
        onRetry={() => void load()}
      >
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="p-2">
            <ul className="space-y-1">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      t.id === selectedId ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="block truncate">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.key}</span>
                  </button>
                </li>
              ))}
              {templates.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum template cadastrado.
                </li>
              )}
            </ul>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tpl-key">Chave</Label>
                <Input
                  id="tpl-key"
                  value={draft.key ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                  placeholder="lead_notification"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-name">Nome</Label>
                <Input
                  id="tpl-name"
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Notificação de novo lead"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-subject">Assunto</Label>
              <Input
                id="tpl-subject"
                value={draft.subject ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-html">HTML</Label>
              <Textarea
                id="tpl-html"
                rows={10}
                className="font-mono text-xs"
                value={draft.html ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, html: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-enabled"
                  checked={draft.enabled ?? true}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
                />
                <Label htmlFor="tpl-enabled">Ativo</Label>
              </div>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="mr-2 h-4 w-4" aria-hidden />
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>

            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4" aria-hidden /> Preview
              </h2>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="mb-2 text-xs text-muted-foreground">Assunto: {draft.subject || '—'}</p>
                <iframe
                  title="Preview do e-mail"
                  className="h-64 w-full rounded border border-border bg-white"
                  sandbox=""
                  srcDoc={draft.html || '<p style="font-family:sans-serif">Sem conteúdo</p>'}
                />
              </div>
            </section>
          </Card>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Entregas recentes (webhook Resend)</h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Evento</th>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Assunto</th>
                  <th className="px-3 py-2 text-left">Quando</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Badge variant={EVENT_TONE[e.event_type] ?? 'secondary'}>{e.event_type}</Badge>
                    </td>
                    <td className="px-3 py-2">{e.template ?? '—'}</td>
                    <td className="max-w-[20rem] truncate px-3 py-2">{e.subject ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum evento de e-mail registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>
      </AsyncBoundary>
    </main>
  );
};

export default AdminEmailTemplatesPage;
