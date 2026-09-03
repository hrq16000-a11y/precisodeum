import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PROGRAMMATIC_OVERRIDES_KEY, type ProgrammaticOverride } from '@/lib/seo/programmaticOverrides';
import { reindexSitemaps } from '@/lib/seo/reindexSitemaps';

export interface OverrideTarget {
  path: string;
  vertical: string;
  citySlug: string | null;
  neighborhoodSlug: string | null;
  /** Metadados gerados automaticamente (placeholder dos campos). */
  generatedTitle?: string;
  generatedDescription?: string;
  generatedKeywords?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: OverrideTarget | null;
  current: ProgrammaticOverride | null;
}

/** Edita title/description/keywords e ativa/desativa uma landing programática. */
export default function ProgrammaticOverrideDialog({ open, onOpenChange, target, current }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [note, setNote] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitle(current?.title || '');
    setDescription(current?.meta_description || '');
    setKeywords(current?.keywords || '');
    setNote(current?.editorial_note || '');
    setEnabled(current?.enabled ?? true);
  }, [open, current]);

  const save = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const { data: auth } = await supabase.auth.getUser();
      const payload = {
        path: target.path,
        vertical: target.vertical,
        city_slug: target.citySlug,
        neighborhood_slug: target.neighborhoodSlug,
        enabled,
        title: title.trim() || null,
        meta_description: description.trim() || null,
        keywords: keywords.trim() || null,
        editorial_note: note.trim() || null,
        created_by: auth.user?.id ?? null,
      };
      const { error } = await supabase
        .from('programmatic_page_overrides')
        .upsert(payload, { onConflict: 'path' });
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: PROGRAMMATIC_OVERRIDES_KEY });
      qc.invalidateQueries({ queryKey: ['programmatic-page-override', target?.path] });
      toast.success('Página programática atualizada');
      onOpenChange(false);
      await reindexSitemaps({ silent: true });
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const { error } = await supabase
        .from('programmatic_page_overrides')
        .delete()
        .eq('id', current.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: PROGRAMMATIC_OVERRIDES_KEY });
      qc.invalidateQueries({ queryKey: ['programmatic-page-override', target?.path] });
      toast.success('Personalização removida — a página volta ao conteúdo automático');
      onOpenChange(false);
      await reindexSitemaps({ silent: true });
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível remover'),
  });

  const titleLen = (title || target?.generatedTitle || '').length;
  const descLen = (description || target?.generatedDescription || '').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar página programática</DialogTitle>
          <DialogDescription className="break-all">{target?.path}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="ppo-enabled">Página ativa</Label>
              <p className="text-xs text-muted-foreground">
                Desativada, a URL fica noindex e sai da lista pública.
              </p>
            </div>
            <Switch id="ppo-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ppo-title">Title ({titleLen} caracteres)</Label>
            <Input
              id="ppo-title"
              value={title}
              placeholder={target?.generatedTitle || 'Gerado automaticamente'}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ppo-desc">Meta description ({descLen} caracteres)</Label>
            <Textarea
              id="ppo-desc"
              rows={3}
              value={description}
              placeholder={target?.generatedDescription || 'Gerada automaticamente'}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ppo-kw">Keywords</Label>
            <Input
              id="ppo-kw"
              value={keywords}
              placeholder={target?.generatedKeywords || 'Geradas automaticamente'}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ppo-note">Nota editorial (interna)</Label>
            <Textarea id="ppo-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={!current || remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remover personalização
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !target}>
              {save.isPending ? 'Salvando...' : 'Salvar e reindexar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
