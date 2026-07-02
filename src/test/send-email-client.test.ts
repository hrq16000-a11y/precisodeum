/**
 * E2E (mock) do cliente de envio de e-mail via supabase.functions.invoke.
 * Valida:
 *  - payload inclui template + vars (nome, link)
 *  - sucesso retorna id e dispara toast pt-BR
 *  - falha (502) dispara toast de erro pt-BR
 *  - mock do WhatsApp valida payload com serviço/cidade
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSmartMessage, whatsappWebLink, toCanonical } from '@/lib/whatsapp';

const toastError = vi.fn();
const toastSuccess = vi.fn();

const invokeMock = vi.fn();
const supabaseMock = { functions: { invoke: invokeMock } };

async function sendWelcomeEmail(to: string, name: string, confirmationUrl: string) {
  const { data, error } = await supabaseMock.functions.invoke('send-email', {
    body: { to, template: 'welcome', vars: { name, confirmation_url: confirmationUrl } },
  });
  if (error || !data?.ok) {
    toastError('Não foi possível enviar o e-mail. Tente novamente em instantes.');
    return null;
  }
  toastSuccess('E-mail enviado com sucesso.');
  return data.id as string;
}

beforeEach(() => {
  invokeMock.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe('send-email client (mock)', () => {
  it('envia template welcome com nome e link e mostra toast pt-BR no sucesso', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, id: 'msg_1' }, error: null });
    const id = await sendWelcomeEmail('a@b.com', 'Maria', 'https://precisodeum.com.br/c?t=1');
    expect(id).toBe('msg_1');
    const call = invokeMock.mock.calls[0][1].body;
    expect(call.template).toBe('welcome');
    expect(call.vars).toMatchObject({ name: 'Maria', confirmation_url: 'https://precisodeum.com.br/c?t=1' });
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/E-mail enviado com sucesso/i));
  });

  it('falha 502 → toast de erro pt-BR e nenhum id', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'Failed', status: 502 } });
    const id = await sendWelcomeEmail('a@b.com', 'X', 'https://precisodeum.com.br');
    expect(id).toBeNull();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Não foi possível enviar/i));
  });
});

describe('lead → WhatsApp payload (mock)', () => {
  function sendLead(provider: { name?: string; whatsapp?: string }, ctx: { service: string; city: string; state: string }) {
    const canonical = toCanonical(provider.whatsapp || '');
    if (!canonical) {
      toastError('WhatsApp do profissional indisponível. Tente novamente em instantes.');
      return null;
    }
    const msg = buildSmartMessage(provider.name || 'profissional', ctx.service, ctx.city, ctx.state);
    return whatsappWebLink(canonical, msg);
  }

  it('payload inclui serviço e cidade', () => {
    const url = sendLead({ name: 'João', whatsapp: '41997452053' }, { service: 'Encanador', city: 'Curitiba', state: 'PR' });
    expect(url).toMatch(/^https:\/\/wa\.me\/5541997452053\?text=/);
    const text = decodeURIComponent(url!.split('text=')[1]);
    expect(text).toMatch(/Encanador/);
    expect(text).toMatch(/Curitiba\/PR/);
  });

  it('falha sem WhatsApp dispara toast pt-BR', () => {
    const url = sendLead({ name: 'João' }, { service: 'X', city: 'Y', state: 'PR' });
    expect(url).toBeNull();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/WhatsApp do profissional indisponível/i));
  });
});
