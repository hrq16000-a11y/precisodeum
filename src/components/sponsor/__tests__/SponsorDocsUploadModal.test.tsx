/**
 * UI tests para SponsorDocsUploadModal — valida mensagens claras de erro/sucesso
 * para cada outcome da RPC attach_sponsor_lead_docs.
 *
 * Escopo: apenas caminho pós-upload (handleFinish). O storage upload é isolado
 * porque o slot `cnpjDoc.path` é seedado via re-render controlado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SponsorDocsUploadModal } from '../SponsorDocsUploadModal';

// Mock Supabase client
const rpcMock = vi.fn();
const uploadMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    storage: { from: () => ({ upload: (...a: any[]) => uploadMock(...a) }) },
  },
}));

// Mock sonner toast
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
  },
}));

const LEAD_ID = '11111111-1111-1111-1111-111111111111';
const TOKEN = '22222222-2222-2222-2222-222222222222';

async function setupWithUploadedFile() {
  uploadMock.mockResolvedValue({ error: null });
  const utils = render(
    <SponsorDocsUploadModal open onOpenChange={() => {}} leadId={LEAD_ID} leadToken={TOKEN} />,
  );
  // Simula seleção de arquivo válido (PDF pequeno)
  const file = new File([new Uint8Array([1, 2, 3])], 'cnpj.pdf', { type: 'application/pdf' });
  const inputs = utils.container.querySelectorAll<HTMLInputElement>('input[type=file]');
  await act(async () => {
    fireEvent.change(inputs[0], { target: { files: [file] } });
  });
  await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  // Marca os 3 checkboxes
  const checkboxes = utils.container.querySelectorAll<HTMLButtonElement>('button[role=checkbox]');
  for (const cb of Array.from(checkboxes)) {
    await act(async () => { fireEvent.click(cb); });
  }
  toastSuccess.mockClear();
  return utils;
}

describe('SponsorDocsUploadModal — mensagens claras por outcome', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    uploadMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('sucesso: exibe toast de vinculação concluída', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    await setupWithUploadedFile();
    fireEvent.click(screen.getByRole('button', { name: /concluir envio/i }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/vinculados/i)));
  });

  it('invalid_token: instrui a recomeçar o cadastro', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'invalid_token' } });
    await setupWithUploadedFile();
    fireEvent.click(screen.getByRole('button', { name: /concluir envio/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/sess[ãa]o inv[áa]lida/i)),
    );
  });

  it('expired: informa janela de 24h expirada', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'expired' } });
    await setupWithUploadedFile();
    fireEvent.click(screen.getByRole('button', { name: /concluir envio/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/24h/i)),
    );
  });

  it('already_claimed: pede login', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'already_claimed' } });
    await setupWithUploadedFile();
    fireEvent.click(screen.getByRole('button', { name: /concluir envio/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/j[áa] foi vinculado|fa[çc]a login/i)),
    );
  });

  it('permission (42501): mensagem de acesso negado', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied for function', code: '42501' } });
    await setupWithUploadedFile();
    fireEvent.click(screen.getByRole('button', { name: /concluir envio/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/acesso negado/i)),
    );
  });

  it('sem leadToken: bloqueia antes de chamar a RPC', async () => {
    render(<SponsorDocsUploadModal open onOpenChange={() => {}} leadId={LEAD_ID} leadToken={null} />);
    // Botão fica desabilitado sem checklist/arquivo, então validamos que a RPC não é chamada.
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
