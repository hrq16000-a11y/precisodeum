/**
 * Lazy wrapper for the Sponsor PDF exporter.
 * The heavy implementation (jspdf + jspdf-autotable, ~300kB) is only
 * downloaded when the user actually clicks the "Exportar PDF" button.
 */
import type { SponsorPdfData } from './exportSponsorPdf.impl';

export type { SponsorPdfData };

export async function exportSponsorPdf(data: SponsorPdfData): Promise<void> {
  const mod = await import('./exportSponsorPdf.impl');
  return mod.exportSponsorPdf(data);
}
