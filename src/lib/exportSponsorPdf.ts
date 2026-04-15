/**
 * Generates a Sponsor ROI PDF report via browser print-to-PDF.
 * Zero-dependency, ultra-professional layout.
 */

interface SponsorPdfData {
  sponsorName: string;
  plan: string;
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  periodImpressions: number;
  periodClicks: number;
  slotRanking: Array<{ name: string; impressions: number; clicks: number }>;
  pageRanking: Array<{ name: string; impressions: number; clicks: number }>;
  dailyData: Array<{ date: string; impressions: number; clicks: number }>;
}

function tableHtml(headers: string[], rows: string[][]): string {
  const ths = headers.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function barHtml(pct: number, color: string): string {
  return `<div style="background:#f1f5f9;border-radius:4px;height:14px;width:100%;"><div style="background:${color};height:100%;width:${Math.min(pct, 100)}%;border-radius:4px;min-width:2px;"></div></div>`;
}

export function exportSponsorPdf(data: SponsorPdfData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const maxImpr = Math.max(...data.slotRanking.map(s => s.impressions), 1);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Performance - ${data.sponsorName}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 15mm; size: A4; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #0f172a; letter-spacing: -0.5px; }
  .header .meta { text-align: right; color: #64748b; font-size: 10px; }
  .badge { display: inline-block; background: #0f172a; color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
  h2 { font-size: 13px; color: #0f172a; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; letter-spacing: -0.3px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -1px; }
  .kpi-label { font-size: 9px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 10px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .slot-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .slot-label { width: 120px; font-weight: 500; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .slot-bar { flex: 1; }
  .slot-val { width: 50px; text-align: right; font-weight: 700; font-size: 10px; }
  .growth-section { margin-top: 12px; }
  .growth-chart { display: flex; align-items: flex-end; gap: 2px; height: 60px; margin-top: 6px; }
  .growth-bar { flex: 1; background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 2px 2px 0 0; min-width: 4px; }
  .footer { margin-top: 24px; text-align: center; color: #94a3b8; font-size: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .footer strong { color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📊 Relatório de Performance</h1>
      <span class="badge">${data.plan || 'Patrocinador'}</span>
    </div>
    <div class="meta">
      <strong>${data.sponsorName}</strong><br/>
      ${dateStr}
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${data.totalImpressions.toLocaleString('pt-BR')}</div>
      <div class="kpi-label">Impressões Totais</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.totalClicks.toLocaleString('pt-BR')}</div>
      <div class="kpi-label">Cliques Totais</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.ctr}%</div>
      <div class="kpi-label">CTR Geral</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${data.periodImpressions.toLocaleString('pt-BR')}</div>
      <div class="kpi-label">Impressões (30d)</div>
      <div class="kpi-sub">${data.periodClicks.toLocaleString('pt-BR')} cliques</div>
    </div>
  </div>

  <div class="two-col">
    <div>
      <h2>📍 Desempenho por Posição</h2>
      ${data.slotRanking.length === 0 ? '<p style="color:#94a3b8;padding:8px;">Sem dados de posições.</p>' :
        data.slotRanking.map(s => `
          <div class="slot-row">
            <span class="slot-label">${s.name}</span>
            <div class="slot-bar">${barHtml((s.impressions / maxImpr) * 100, '#3b82f6')}</div>
            <span class="slot-val">${s.impressions.toLocaleString('pt-BR')}</span>
          </div>
        `).join('')
      }
    </div>
    <div>
      <h2>🌎 Alcance por Página/Cidade</h2>
      ${data.pageRanking.length === 0 ? '<p style="color:#94a3b8;padding:8px;">Sem dados de páginas.</p>' :
        tableHtml(
          ['Página', 'Impressões', 'Cliques'],
          data.pageRanking.map(p => [p.name, p.impressions.toLocaleString('pt-BR'), p.clicks.toLocaleString('pt-BR')])
        )
      }
    </div>
  </div>

  <h2>📈 Tendência Diária (30 dias)</h2>
  ${data.dailyData.filter(d => d.impressions > 0 || d.clicks > 0).length === 0 
    ? '<p style="color:#94a3b8;text-align:center;padding:12px;">Nenhuma métrica registrada nos últimos 30 dias.</p>'
    : (() => {
        const maxDaily = Math.max(...data.dailyData.map(d => d.impressions), 1);
        return `<div class="growth-chart">
          ${data.dailyData.map(d => `<div class="growth-bar" style="height:${Math.max((d.impressions / maxDaily) * 100, 2)}%" title="${d.date}: ${d.impressions} imp, ${d.clicks} cli"></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;margin-top:2px;">
          <span>${data.dailyData[0]?.date || ''}</span>
          <span>${data.dailyData[data.dailyData.length - 1]?.date || ''}</span>
        </div>`;
      })()
  }

  ${data.dailyData.filter(d => d.impressions > 0).length > 0 ? `
  <h2>📋 Dados Detalhados</h2>
  ${tableHtml(
    ['Data', 'Impressões', 'Cliques', 'CTR'],
    data.dailyData.filter(d => d.impressions > 0 || d.clicks > 0).map(d => [
      d.date,
      d.impressions.toLocaleString('pt-BR'),
      d.clicks.toLocaleString('pt-BR'),
      d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(1) + '%' : '0%',
    ])
  )}` : ''}

  <div class="footer">
    <strong>Preciso de um</strong> · Relatório de Performance do Patrocinador · ${dateStr}<br/>
    Este relatório é gerado automaticamente pela plataforma.
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
