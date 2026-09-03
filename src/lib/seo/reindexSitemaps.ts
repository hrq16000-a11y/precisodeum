/**
 * Reindexação: dispara a edge function `gsc-submit-sitemaps`, que submete o
 * sitemap index (e sub-sitemaps) ao Google Search Console e registra cada
 * tentativa em `gsc_audit_log` — é esse log que alimenta o acompanhamento de
 * indexação em /admin/seo (abas Submissões e Métricas GSC 7d).
 *
 * A function aceita admin autenticado (`authorizeAdminOrCron`), então o botão
 * do painel funciona sem segredo de cron.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReindexResult {
  ok: boolean;
  submitted?: number;
  succeeded?: number;
  failed?: number;
  error?: string;
}

export async function reindexSitemaps(opts: { silent?: boolean } = {}): Promise<ReindexResult> {
  const site = 'https://precisodeum.com.br/';
  try {
    const { data, error } = await supabase.functions.invoke('gsc-submit-sitemaps', {
      body: { site },
    });
    if (error) throw error;
    const res: ReindexResult = {
      ok: (data?.failed ?? 0) === 0,
      submitted: data?.submitted,
      succeeded: data?.succeeded,
      failed: data?.failed,
    };
    if (!opts.silent) {
      if (res.ok) toast.success(`Sitemap submetido ao Google (${res.succeeded ?? 0} arquivos)`);
      else toast.warning(`Submissão parcial: ${res.failed} falha(s) de ${res.submitted}`);
    }
    return res;
  } catch (e: any) {
    const message = e?.message || 'Falha ao submeter o sitemap';
    if (!opts.silent) toast.error(message);
    return { ok: false, error: message };
  }
}
