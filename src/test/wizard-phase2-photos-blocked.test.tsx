/**
 * Regressão phase2_photos — card de bloqueio.
 *
 * Garante que o ReportWizardErrorButton aceita `contextSnapshot` e que o
 * diálogo de coleta de contexto é aberto com a etapa correta — espelhando
 * o uso feito pelo OnboardingV2Shell quando `firstServiceId` ou `user` faltam.
 *
 * Não montamos o Shell inteiro (denso demais para teste unitário); cobrimos
 * o contrato público que o Shell consome.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn().mockResolvedValue('abcdef0123-report-id'),
  trackAction: vi.fn(),
  getActionHistory: () => [],
}));

import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';

describe('ReportWizardErrorButton — contextSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aceita prop contextSnapshot e renderiza os campos no dialog', async () => {
    render(
      <ReportWizardErrorButton
        step="phase2_photos:no_service"
        componentName="OnboardingV2Shell"
        label="Reportar para o suporte"
        contextSnapshot={{
          code: 'phase2_photos:no_service',
          missing_fields: ['categoria', 'cidade'],
          city: 'Curitiba',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Reportar para o suporte/i }));

    await waitFor(() => {
      expect(screen.getByText(/Contexto que será enviado/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/phase2_photos:no_service/).length).toBeGreaterThan(0);
    expect(screen.getByText(/categoria, cidade/)).toBeInTheDocument();
    expect(screen.getByTestId('report-dialog-note')).toBeInTheDocument();
    expect(screen.getByTestId('report-dialog-send')).toBeInTheDocument();
  });

  it('envia relatório anexando step + contextSnapshot via reportError', async () => {
    const { reportError } = await import('@/lib/errorReporter');

    render(
      <ReportWizardErrorButton
        step="phase2_photos:no_session"
        contextSnapshot={{ code: 'phase2_photos:no_session' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Reportar erro/i }));
    fireEvent.click(await screen.findByTestId('report-dialog-send'));

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledTimes(1);
    });
    const call: any = (reportError as any).mock.calls[0][0];
    expect(call.errorMessage).toContain('phase2_photos:no_session');
    expect(call.actionContext).toContain('phase2_photos:no_session');
    expect(call.errorStack).toContain('phase2_photos:no_session');
  });
});
