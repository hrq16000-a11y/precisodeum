/**
 * Generates a CRM metrics PDF report via printable HTML window.
 * Uses browser's native print-to-PDF for zero-dependency, high-quality output.
 */

interface FunnelItem {
  label: string;
  count: number;
  pct: number;
}

interface GrowthItem {
  date: string;
  users: number;
  providers: number;
}

interface RetentionItem {
  month: string;
  total: number;
  ativos: number;
  inativos: number;
  novos: number;
  retentionRate: number;
}

interface TypeItem {
  name: string;
  value: number;
}

interface CrmPdfData {
  stats: { total: number; new7d: number; new30d: number; activeProviders: number };
  funnelData: FunnelItem[];
  growthData: GrowthItem[];
  retentionData: RetentionItem[];
  typeDistribution: TypeItem[];
  totalLeads: number;
}

function tableHtml(headers: string[], rows: string[][]): string {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function barHtml(pct: number, color: string): string {
  return `<div style="background:#f1f5f9;border-radius:4px;height:18px;width:100%;position:relative;">
    <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;min-width:2px;"></div>
  </div>`;
}

export function exportCrmPdf(data: CrmPdfData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const funnelColors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório CRM - ${dateStr}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 15mm; size: A4; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; padding: 20px; }
  h1 { font-size: 20px; color: #0f172a; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #334155; margin: 18px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 11px; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-value { font-size: 22px; font-weight: 700; color: #0f172a; }
  .kpi-label { font-size: 10px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 10px; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .funnel-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .funnel-label { width: 140px; font-weight: 500; font-size: 11px; }
  .funnel-bar { flex: 1; }
  .funnel-count { width: 60px; text-align: right; font-weight: 600; font-size: 11px; }
  .funnel-pct { width: 40px; text-align: right; color: #64748b; font-size: 10px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .footer { margin-top: 20px; text-align: center; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
  <h1>📊 Relatório CRM</h1>
  <p class="subtitle">Gerado em ${dateStr}</p>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${data.stats.total}</div><div class="kpi-label">Total Usuários</div></div>
    <div class="kpi"><div class="kpi-value">${data.stats.activeProviders}</div><div class="kpi-label">Profissionais Ativos</div></div>
    <div class="kpi"><div class="kpi-value">${data.stats.new30d}</div><div class="kpi-label">Novos (30 dias)</div></div>
    <div class="kpi"><div class="kpi-value">${data.totalLeads}</div><div class="kpi-label">Total Leads</div></div>
  </div>

  <h2>🎯 Funil de Conversão</h2>
  ${data.funnelData.map((f, i) => `
    <div class="funnel-row">
      <span class="funnel-label">${f.label}</span>
      <div class="funnel-bar">${barHtml(f.pct, funnelColors[i] || '#94a3b8')}</div>
      <span class="funnel-count">${f.count}</span>
      <span class="funnel-pct">${f.pct}%</span>
    </div>
  `).join('')}

  <div class="two-col">
    <div>
      <h2>📈 Crescimento (30 dias)</h2>
      ${tableHtml(
        ['Data', 'Usuários', 'Profissionais'],
        data.growthData.filter(d => d.users > 0 || d.providers > 0).map(d => [d.date, String(d.users), String(d.providers)])
      )}
      ${data.growthData.filter(d => d.users > 0 || d.providers > 0).length === 0 ? '<p style="color:#94a3b8;text-align:center;padding:12px;">Sem novos cadastros nos últimos 30 dias</p>' : ''}
    </div>
    <div>
      <h2>👥 Distribuição por Tipo</h2>
      ${tableHtml(
        ['Tipo', 'Total', '%'],
        data.typeDistribution.map(d => [
          d.name,
          String(d.value),
          data.stats.total ? Math.round((d.value / data.stats.total) * 100) + '%' : '0%',
        ])
      )}
    </div>
  </div>

  <h2>🔄 Retenção (12 meses)</h2>
  ${tableHtml(
    ['Mês', 'Total', 'Ativos', 'Inativos', 'Novos', 'Retenção'],
    data.retentionData.map(r => [r.month, String(r.total), String(r.ativos), String(r.inativos), String(r.novos), r.retentionRate + '%'])
  )}

  <div class="footer">Preciso de Um · Relatório CRM · ${dateStr}</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
