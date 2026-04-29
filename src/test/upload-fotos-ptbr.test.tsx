import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * E2E mobile-first do upload de fotos (portfólio/avatar):
 *  - Mensagem de erro pt-BR quando arquivo > 5MB
 *  - Mensagem pt-BR quando usuário não está logado
 *  - Mensagem pt-BR genérica quando a edge function falha
 *  - Botões e labels pt-BR responsivos
 */

const getSession = vi.fn();
const fetchMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: (...a: unknown[]) => getSession(...a) },
  },
}));
vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
    info: (m: string) => toastInfo(m),
  },
}));
vi.mock('@/lib/compressImage', () => ({
  compressImage: async (f: File) => f,
  generateBlurDataUrl: async () => null,
}));
vi.mock('@/lib/imageResolver', () => ({ handleImageError: () => {} }));
vi.mock('@/lib/mediaUtils', () => ({
  upsertMedia: vi.fn(),
  resolveIdentity: async () => ({ userRef: null }),
}));

beforeEach(() => {
  getSession.mockReset();
  fetchMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  toastInfo.mockReset();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
  (globalThis as any).fetch = fetchMock;
});

const makeFile = (size: number, type = 'image/jpeg'): File => {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], 'foto.jpg', { type });
};

const renderUploader = async () => {
  const { default: ImageUploadField } = await import('@/components/ImageUploadField');
  return render(<ImageUploadField value="" onChange={() => {}} label="Foto do portfólio" />);
};

describe('Upload de fotos — UI pt-BR mobile-first', () => {
  it('renderiza alternador URL/Upload e label pt-BR', async () => {
    await renderUploader();
    expect(screen.getByText(/Foto do portfólio/i)).toBeInTheDocument();
    expect(screen.getByText(/^URL$/)).toBeInTheDocument();
    expect(screen.getByText(/^Upload$/)).toBeInTheDocument();
  });

  it('rejeita arquivos > 5MB com toast pt-BR', async () => {
    await renderUploader();
    fireEvent.click(screen.getByText(/^Upload$/));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = makeFile(6 * 1024 * 1024);
    Object.defineProperty(input, 'files', { value: [big] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/no máximo 5MB/i)),
    );
  });

  it('mostra mensagem pt-BR quando usuário não está logado', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await renderUploader();
    fireEvent.click(screen.getByText(/^Upload$/));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile(100 * 1024);
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/precisa estar logado para enviar imagens/i),
      ),
    );
  });

  it('mostra erro pt-BR quando edge function falha', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'u1' } } },
    });
    fetchMock.mockResolvedValue({
      json: async () => ({ error: 'storage_full' }),
    });
    await renderUploader();
    fireEvent.click(screen.getByText(/^Upload$/));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile(100 * 1024);
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Erro ao enviar imagem/i)),
    );
  });

  it('mostra toast de sucesso pt-BR quando upload conclui', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'u1' } } },
    });
    fetchMock.mockResolvedValue({
      json: async () => ({ url: 'https://cdn/test.webp', path: 'p/test.webp' }),
    });
    await renderUploader();
    fireEvent.click(screen.getByText(/^Upload$/));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile(100 * 1024);
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Imagem enviada/i)),
    );
  });

  it('mostra info pt-BR quando edge function deduplicou', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'u1' } } },
    });
    fetchMock.mockResolvedValue({
      json: async () => ({ url: 'https://cdn/x.webp', path: 'p/x.webp', deduplicated: true }),
    });
    await renderUploader();
    fireEvent.click(screen.getByText(/^Upload$/));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile(100 * 1024);
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(expect.stringMatching(/já existente reutilizada/i)),
    );
  });
});
