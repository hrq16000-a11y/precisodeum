/**
 * Modal "Modelos de Mensagem" do WhatsApp.
 *
 * - Lista todos os modelos do usuário.
 * - Cria/edita/remove com pré-visualização ao vivo (substitui variáveis).
 * - Botões de inserção rápida das variáveis suportadas.
 *
 * Estilo Editorial: contraste alto, bordas suaves, sombra de card.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, MessageSquareText, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  TEMPLATE_VARIABLES, renderTemplate,
  useDeleteWhatsappTemplate, useSaveWhatsappTemplate, useWhatsappTemplates,
  type WhatsappTemplate,
} from '@/hooks/useWhatsappTemplates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se passado, ao salvar/clicar em "Usar agora" devolve o conteúdo renderizado. */
  previewVars?: { cliente?: string | null; servico?: string | null; meu_nome?: string | null };
}

export default function WhatsappTemplatesModal({ open, onOpenChange, previewVars }: Props) {
  const { data: templates = [], isLoading } = useWhatsappTemplates();
  const save = useSaveWhatsappTemplate();
  const remove = useDeleteWhatsappTemplate();

  const [editing, setEditing] = useState<WhatsappTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!open) { setEditing(null); setTitle(''); setContent(''); }
  }, [open]);

  function startNew() { setEditing(null); setTitle(''); setContent(''); }
  function startEdit(t: WhatsappTemplate) { setEditing(t); setTitle(t.title); setContent(t.content); }
  function insertVar(key: string) { setContent((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}${key} `); }

  async function handleSave() {
    await save.mutateAsync({ id: editing?.id, title, content });
    startNew();
  }

  const previewText = useMemo(
    () => renderTemplate(content || 'Olá {{cliente}}, sou {{meu_nome}} e vi seu pedido sobre {{servico}}.', previewVars || {}),
    [content, previewVars],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
            <MessageSquareText className="h-5 w-5 text-emerald-600" /> Modelos de mensagem
          </DialogTitle>
          <DialogDescription>
            Use variáveis para personalizar automaticamente no envio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_1.2fr]">
          {/* Lista */}
          <aside className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Seus modelos</h3>
              <Button size="sm" variant="outline" onClick={startNew} className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" /> Novo
              </Button>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-card">
              {isLoading && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
              {!isLoading && templates.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Nenhum modelo ainda. Crie o primeiro à direita.</p>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                    editing?.id === t.id ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <button onClick={() => startEdit(t)} className="flex-1 truncate text-left text-sm font-medium text-foreground">
                    {t.title}
                  </button>
                  <button onClick={() => startEdit(t)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Remover "${t.title}"?`)) remove.mutate(t.id); }}
                    className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Editor */}
          <section className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Título</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Primeiro contato após pedido"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/40"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Mensagem</span>
              <textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Olá {{cliente}}, aqui é {{meu_nome}}. Vi que você precisa de {{servico}}…"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/40"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                    title={v.label}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </label>

            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3 w-3" /> Pré-visualização
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{previewText}</p>
            </div>

            <div className="flex justify-end gap-2">
              {editing && (
                <Button variant="outline" onClick={startNew}>Cancelar</Button>
              )}
              <Button
                onClick={handleSave}
                disabled={save.isPending}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {save.isPending ? 'Salvando…' : editing ? 'Atualizar modelo' : 'Salvar modelo'}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
