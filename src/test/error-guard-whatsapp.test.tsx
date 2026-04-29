import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ErrorGuard from '@/components/ErrorGuard';

/**
 * E2E ErrorGuard — durante fluxo de login/cadastro com erro:
 *  - Botão "Copiar mensagem" copia o payload completo em pt-BR via clipboard.
 *  - Botão "Enviar para o suporte" abre wa.me com texto pt-BR codificado.
 *  - Mensagem inclui código, rota, componente, tela e dispositivo.
 */

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn().mockResolvedValue('rep_abc12345xyz'),
}));

const Boom = ({ trigger }: { trigger: boolean }) => {
  if (trigger) throw new Error('Falha no fluxo de cadastro');
  return <div>ok</div>;
};

beforeEach(() => {
  // Silencia o console.error que o React boundary emite
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, pathname: '/login', search: '?next=/dashboard' },
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605',
  });
});

describe('ErrorGuard — copiar mensagem e abrir WhatsApp em pt-BR', () => {
  it('renderiza UI pt-BR com código de erro e dica de print', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(
      <ErrorGuard componentName="LoginPage">
        <Boom trigger />
      </ErrorGuard>,
    );
    expect(await screen.findByText(/Algo deu errado/i)).toBeInTheDocument();
    expect(screen.getByText(/Tire um print desta tela/i)).toBeInTheDocument();
    expect(screen.getByText(/Código do erro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Copiar mensagem/i })).toBeInTheDocument(),
    );
  });

  it('copia mensagem completa pt-BR no clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <ErrorGuard componentName="LoginPage">
        <Boom trigger />
      </ErrorGuard>,
    );

    const copyBtn = await screen.findByRole('button', { name: /Copiar mensagem/i });
    fireEvent.click(copyBtn);

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = writeText.mock.calls[0][0] as string;

    expect(payload).toMatch(/Olá! Preciso de ajuda com um erro na plataforma Preciso de Um/);
    expect(payload).toMatch(/• Código: rep_abc12345xyz/);
    expect(payload).toMatch(/• Rota: \/login\?next=\/dashboard/);
    expect(payload).toMatch(/• Componente: LoginPage/);
    expect(payload).toMatch(/• Mensagem: Falha no fluxo de cadastro/);
    expect(payload).toMatch(/• Tela: 390x844/);
    expect(payload).toMatch(/• Dispositivo: Mozilla\/5\.0/);
    expect(payload).toMatch(/Já tirei um print da tela\. Podem me ajudar\?/);
  });

  it('abre WhatsApp (wa.me) com payload pt-BR codificado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ErrorGuard componentName="SignupFlow">
        <Boom trigger />
      </ErrorGuard>,
    );

    const sendBtn = await screen.findByRole('button', { name: /Enviar para o suporte/i });
    fireEvent.click(sendBtn);

    await waitFor(() => expect(open).toHaveBeenCalled());
    const url = open.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);

    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toMatch(/Preciso de ajuda/);
    expect(text).toMatch(/Componente: SignupFlow/);
    expect(text).toMatch(/Já tirei um print/);

    open.mockRestore();
  });
});
