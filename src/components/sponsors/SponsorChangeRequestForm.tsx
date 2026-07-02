import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  changeRequestSchema,
  diffChanges,
  FIELD_LABELS,
  SENSITIVE_FIELDS,
  type ChangeRequestPayload,
} from '@/lib/sponsorSelfService';

interface Props {
  sponsorId: string;
  snapshot: Record<string, unknown>;
  hasPending: boolean;
  onSubmitted: () => void;
}

/** Formulário de solicitação de alteração — fail-closed, sem mutar `sponsors` direto. */
const SponsorChangeRequestForm = ({ sponsorId, snapshot, hasPending, onSubmitted }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState, reset } = useForm<ChangeRequestPayload>({
    resolver: zodResolver(changeRequestSchema),
    defaultValues: {
      link_url: (snapshot.link_url as string) || '',
      external_link: (snapshot.external_link as string) || '',
      phone: (snapshot.phone as string) || '',
      whatsapp: (snapshot.whatsapp as string) || '',
      short_description: (snapshot.short_description as string) || '',
      full_description: (snapshot.full_description as string) || '',
      linked_city: (snapshot.linked_city as string) || '',
      linked_category: (snapshot.linked_category as string) || '',
    },
  });

  const submit = handleSubmit(async (values) => {
    if (hasPending) {
      toast.error('Já existe uma solicitação pendente. Aguarde a revisão ou cancele.');
      return;
    }
    const diff = diffChanges(values, snapshot);
    if (Object.keys(diff).length === 0) {
      toast.info('Nenhuma alteração detectada.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('sponsor_submit_change_request' as any, {
        _sponsor_id: sponsorId,
        _changes: diff,
      });
      if (error) throw error;
      toast.success('Solicitação enviada. Aguarde a revisão do administrador.');
      reset(values);
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  });

  const requestRenewal = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('sponsor_submit_change_request' as any, {
        _sponsor_id: sponsorId,
        _changes: { renewal_requested: true },
      });
      if (error) throw error;
      toast.success('Pedido de renovação enviado ao administrador.');
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao solicitar renovação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar campanha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPending && (
          <Alert>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Existe uma solicitação pendente. Aguarde a revisão ou cancele para enviar outra.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="link_url" label={FIELD_LABELS.link_url} {...register('link_url')} error={formState.errors.link_url?.message} />
          <Field id="external_link" label={FIELD_LABELS.external_link} {...register('external_link')} error={formState.errors.external_link?.message} />
          <Field id="phone" label={FIELD_LABELS.phone} {...register('phone')} error={formState.errors.phone?.message} />
          <Field id="whatsapp" label={FIELD_LABELS.whatsapp} {...register('whatsapp')} error={formState.errors.whatsapp?.message} />

          <div className="space-y-2">
            <Label htmlFor="short_description">{FIELD_LABELS.short_description}</Label>
            <Textarea id="short_description" rows={2} maxLength={160} {...register('short_description')} />
            {formState.errors.short_description && (
              <p className="text-sm text-destructive">{formState.errors.short_description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_description">{FIELD_LABELS.full_description}</Label>
            <Textarea id="full_description" rows={4} maxLength={1200} {...register('full_description')} />
            {formState.errors.full_description && (
              <p className="text-sm text-destructive">{formState.errors.full_description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="linked_city"
              label={`${FIELD_LABELS.linked_city} (requer aprovação)`}
              {...register('linked_city')}
              error={formState.errors.linked_city?.message}
            />
            <Field
              id="linked_category"
              label={`${FIELD_LABELS.linked_category} (requer aprovação)`}
              {...register('linked_category')}
              error={formState.errors.linked_category?.message}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Campos marcados como sensíveis ({Array.from(SENSITIVE_FIELDS).map((k) => FIELD_LABELS[k]).join(', ')}) passam por revisão obrigatória do administrador.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting || hasPending}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Solicitar alteração
            </Button>
            <Button type="button" variant="outline" onClick={requestRenewal} disabled={submitting || hasPending}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Solicitar renovação
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const Field = ({
  id,
  label,
  error,
  ...rest
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} {...(rest as any)} />
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

export default SponsorChangeRequestForm;
