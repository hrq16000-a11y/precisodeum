/**
 * Regressão ReportWizardErrorButton — etapa "recebido" e contador de anexos.
 *
 * Cobre os contratos novos:
 *  - Contador "x/3" sempre visível.
 *  - Após sucesso, o diálogo NÃO fecha automaticamente: mostra ticket + permite reenvio.
 *  - O payload enviado ao `reportError` contém: code, step, contextSnapshot, browser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const { storageUpload, dbUpdate } = vi.hoisted(() => ({
  storageUpload: vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null }),
  dbUpdate: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: vi.fn().mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((...args: any[]) => dbUpdate(...args)),
      }),
    })),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockImplementation((...args: any[]) => storageUpload(...args)),
      }),
    },
  },
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn().mockResolvedValue('abcdef0123-receipt-456'),
  trackAction: vi.fn(),
  getActionHistory: () => [],
}));

import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';

describe('ReportWizardErrorButton — receipt + counter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra contador x/MAX antes de qualquer anexo', async () => {
    render(<ReportWizardErrorButton step="phase2_photos:no_service" />);
    fireEvent.click(screen.getByRole('button', { name: /Reportar erro/i }));
    const counter = await screen.findByTestId('report-dialog-attach-counter');
    expect(counter.textContent).toMatch(/0\/3/);
  });

  it('payload enviado contém code canônico, step, contextSnapshot e browser', async () => {
    const { reportError } = await import('@/lib/errorReporter');
    render(
      <ReportWizardErrorButton
        step="phase2_photos:no_service"
        contextSnapshot={{ code: 'phase2_photos:no_service', city: 'Curitiba', category: 'cat-1' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reportar erro/i }));
    fireEvent.click(await screen.findByTestId('report-dialog-send'));

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    const call: any = (reportError as any).mock.calls[0][0];
    const stack = JSON.parse(call.errorStack);
    expect(stack.code).toBe('phase2_photos:no_service');
    expect(stack.step).toBe('phase2_photos:no_service');
    expect(stack.contextSnapshot.city).toBe('Curitiba');
    expect(stack.browser).toBeTruthy();
    expect(stack.browser.userAgent).toBeTruthy();
  });

  it('após enviar, mostra etapa "recebido" com ticket de 8 chars', async () => {
    render(<ReportWizardErrorButton step="phase2_photos:no_service" />);
    fireEvent.click(screen.getByRole('button', { name: /Reportar erro/i }));
    fireEvent.click(await screen.findByTestId('report-dialog-send'));

    const receipt = await screen.findByTestId('report-dialog-receipt');
    expect(receipt).toBeInTheDocument();
    const ticket = await screen.findByTestId('report-dialog-ticket');
    // 'abcdef0123-receipt-456'.slice(0,8) === 'abcdef01'
    expect(ticket.textContent).toContain('abcdef01');
    expect(screen.getByTestId('report-dialog-close')).toBeInTheDocument();
  });
});
