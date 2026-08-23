import { useState } from 'react';
import { z } from 'zod';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
  email: z.string().trim().email('E-mail inválido').max(200).optional().or(z.literal('')),
  phone: z.string().trim().min(8, 'Telefone/WhatsApp inválido').max(30),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
});

interface Props {
  categorySlug: string;
  categoryName: string;
  city?: string | null;
}

const KINDS = [
  { value: 'professional', label: 'Sou profissional' },
  { value: 'sponsor', label: 'Quero patrocinar' },
] as const;

/**
 * Formulário de interesse exibido nas categorias sem prestador.
 * Persiste o lead em `category_opportunity_leads` para contato comercial.
 */
const OpportunityLeadForm = ({ categorySlug, categoryName, city }: Props) => {
  const [kind, setKind] = useState<'professional' | 'sponsor'>('professional');
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: city || '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? '');
        if (key && !next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    setSending(true);
    const { error } = await supabase.from('category_opportunity_leads').insert({
      category_slug: categorySlug,
      category_name: categoryName,
      kind,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      city: parsed.data.city || null,
      message: parsed.data.message || null,
      status: 'new',
      source_path: typeof window !== 'undefined' ? window.location.pathname : null,
    });
    setSending(false);

    if (error) {
      toast.error('Não foi possível enviar agora. Tente novamente em instantes.');
      return;
    }
    setDone(true);
    toast.success('Recebemos seu interesse! Vamos entrar em contato.');
  };

  if (done) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary" />
        <p className="text-sm font-bold text-foreground">Interesse registrado</p>
        <p className="text-xs text-muted-foreground">
          Nossa equipe entra em contato sobre {categoryName}
          {city ? ` em ${city}` : ''} em breve.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 w-full rounded-2xl border border-border bg-card p-5 text-left">
      <h3 className="text-sm font-bold text-foreground">Quero receber os contatos desta categoria</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Deixe seus dados e avisamos assim que alguém procurar {categoryName.toLowerCase()}
        {city ? ` em ${city}` : ''}.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              kind === k.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="opp-name" className="text-xs">Nome*</Label>
          <Input id="opp-name" value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" />
          {errors.name && <p className="mt-1 text-[11px] text-destructive">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="opp-phone" className="text-xs">WhatsApp*</Label>
          <Input id="opp-phone" value={form.phone} onChange={set('phone')} maxLength={30} inputMode="tel" autoComplete="tel" />
          {errors.phone && <p className="mt-1 text-[11px] text-destructive">{errors.phone}</p>}
        </div>
        <div>
          <Label htmlFor="opp-email" className="text-xs">E-mail</Label>
          <Input id="opp-email" value={form.email} onChange={set('email')} maxLength={200} inputMode="email" autoComplete="email" />
          {errors.email && <p className="mt-1 text-[11px] text-destructive">{errors.email}</p>}
        </div>
        <div>
          <Label htmlFor="opp-city" className="text-xs">Cidade</Label>
          <Input id="opp-city" value={form.city} onChange={set('city')} maxLength={120} />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="opp-message" className="text-xs">Mensagem</Label>
        <Textarea id="opp-message" value={form.message} onChange={set('message')} maxLength={1000} rows={3} />
      </div>

      <Button type="submit" size="sm" className="mt-4 w-full gap-1.5" disabled={sending}>
        <Send className="h-3.5 w-3.5" />
        {sending ? 'Enviando...' : 'Tenho interesse'}
      </Button>
    </form>
  );
};

export default OpportunityLeadForm;
