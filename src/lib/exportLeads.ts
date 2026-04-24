import type { LeadRow, LeadHistoryEntry, LeadStatus } from '@/hooks/useLeadFollowup';
import { STATUS_META } from '@/hooks/useLeadFollowup';

const STATUS_LABEL = (s: string) => (STATUS_META as any)[s]?.label ?? s;

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
};

const csvEscape = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v).replace(/\r?\n/g, ' ').trim();
  if (/[",;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

interface ExportInput {
  providerName?: string;
  leads: LeadRow[];
  history: Record<string, LeadHistoryEntry[]>;
  range?: { from?: string; to?: string };
}

const filterByRange = (leads: LeadRow[], range?: ExportInput['range']) => {
  if (!range || (!range.from && !range.to)) return leads;
  const from = range.from ? new Date(range.from).getTime() : -Infinity;
  const to   = range.to   ? new Date(range.to).getTime() + 86_400_000 : Infinity;
  return leads.filter(l => {
    const t = new Date(l.created_at).getTime();
    return t >= from && t <= to;
  });
};

export function exportLeadsCsv(input: ExportInput) {
  const leads = filterByRange(input.leads, input.range);
  const header = [
    'Lead ID','Cliente','Telefone','Serviço','Status','Score','Criado em',
    'Último status em','Próx. follow-up','Janela (h)','Mensagem',
    'Histórico (entradas)','Última entrada do histórico'
  ];
  const rows = leads.map(l => {
    const h = input.history[l.id] || [];
    const last = h[0];
    return [
      l.id, l.client_name, l.phone, l.service_needed ?? '',
      STATUS_LABEL(l.status), l.lead_score ?? 0,
      fmtDate(l.created_at), fmtDate(l.last_status_at), fmtDate(l.next_followup_at),
      l.followup_window_hours, l.message ?? '',
      h.length,
      last ? `[${fmtDate(last.created_at)}] ${last.entry_type}: ${last.message ?? ''}` : ''
    ].map(csvEscape).join(';');
  });
  const csv = '\uFEFF' + [header.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLeadsPdf(input: ExportInput) {
  const leads = filterByRange(input.leads, input.range);
  const provider = input.providerName ? `<p class="sub">Profissional: <strong>${input.providerName}</strong></p>` : '';
  const range = input.range && (input.range.from || input.range.to)
    ? `<p class="sub">Período: ${input.range.from || '—'} até ${input.range.to || '—'}</p>` : '';

  const cards = leads.map(l => {
    const h = input.history[l.id] || [];
    const events = h.slice(0, 30).map(e => `
      <li><span class="t">${fmtDate(e.created_at)}</span>
        <span class="badge">${e.entry_type}</span>
        ${e.old_status && e.new_status ? `<em>${STATUS_LABEL(e.old_status)} → ${STATUS_LABEL(e.new_status)}</em>` : ''}
        ${e.message ? `<div class="msg">${escapeHtml(e.message)}</div>` : ''}
      </li>`).join('');
    return `
      <section class="lead">
        <header>
          <h3>${escapeHtml(l.client_name)} <small>(${escapeHtml(l.phone)})</small></h3>
          <div class="meta">
            <span class="pill">${STATUS_LABEL(l.status)}</span>
            <span>Score ${l.lead_score ?? 0}</span>
            <span>Criado: ${fmtDate(l.created_at)}</span>
            ${l.next_followup_at ? `<span>Próx: ${fmtDate(l.next_followup_at)}</span>` : ''}
          </div>
        </header>
        ${l.service_needed ? `<p class="svc">${escapeHtml(l.service_needed)}</p>` : ''}
        ${l.message ? `<p class="msg">${escapeHtml(l.message)}</p>` : ''}
        <h4>Timeline (${h.length})</h4>
        <ul class="timeline">${events || '<li class="empty">Sem movimentações.</li>'}</ul>
      </section>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Histórico de Leads</title>
<style>
@media print { @page { margin: 14mm; size: A4; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 20px; font-size: 12px; }
h1 { font-size: 22px; margin-bottom: 4px; }
.sub { color: #64748b; font-size: 11px; }
.lead { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 12px 0; page-break-inside: avoid; }
.lead header { border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px; }
.lead h3 { font-size: 14px; }
.lead h3 small { color: #64748b; font-weight: normal; }
.meta { display: flex; gap: 10px; flex-wrap: wrap; color: #64748b; font-size: 11px; margin-top: 4px; }
.pill { background: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.svc { color: #0f766e; font-weight: 500; margin: 6px 0; }
.msg { background: #f8fafc; padding: 8px; border-radius: 6px; margin: 6px 0; }
.lead h4 { font-size: 12px; margin-top: 10px; color: #475569; }
.timeline { list-style: none; padding-left: 0; margin-top: 6px; }
.timeline li { padding: 6px 0 6px 12px; border-left: 2px solid #cbd5e1; margin-left: 4px; font-size: 11px; }
.timeline li .t { color: #64748b; margin-right: 6px; }
.timeline li .badge { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 10px; }
.timeline li .msg { margin-top: 3px; padding: 4px 6px; background: #f8fafc; border-radius: 4px; }
.empty { color: #94a3b8; }
.footer { text-align: center; color: #94a3b8; margin-top: 18px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style></head><body>
<h1>Histórico de Leads</h1>
<p class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${leads.length} lead(s)</p>
${provider}${range}
${cards || '<p style="margin-top:20px;color:#94a3b8;">Nenhum lead no período selecionado.</p>'}
<div class="footer">Preciso de Um · Relatório de Leads</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
