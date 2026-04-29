import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSmartMessage,
  whatsappWebLink,
  whatsappDeepLink,
  whatsappLink,
  toCanonical,
} from '@/lib/whatsapp';

/**
 * E2E do sistema de leads (contato via WhatsApp):
 *  - Payload (URL) inclui número canônico + serviço/cidade no texto
 *  - Mobile usa whatsapp://send (deep link), desktop usa wa.me
 *  - Falha (número inválido) devolve '#' em vez de quebrar a UX
 *  - Toast pt-BR é disparado quando WhatsApp ausente / inválido
 */

describe('Lead/contato — payload do WhatsApp', () => {
  it('wa.me inclui número canônico (55+DDD+número) e texto encodado', () => {
    const url = whatsappWebLink('41997452053', 'Olá! Preciso de Encanador em Curitiba/PR.');
    expect(url.startsWith('https://wa.me/5541997452053?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toMatch(/Encanador/);
    expect(text).toMatch(/Curitiba\/PR/);
  });

  it('mensagem inteligente integrada ao link inclui serviço e cidade', () => {
    const msg = buildSmartMessage('Maria', 'Encanador', 'Curitiba', 'PR');
    const url = whatsappWebLink('41997452053', msg);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toMatch(/Olá Maria!/);
    expect(text).toMatch(/Encanador/);
    expect(text).toMatch(/Curitiba\/PR/);
  });

  it('número inválido devolve href "#" (não tenta abrir wa.me quebrado)', () => {
    expect(whatsappWebLink('123')).toBe('#');
    expect(whatsappDeepLink('abc')).toBe('#');
  });

  it('mobile usa whatsapp://send, desktop usa wa.me', () => {
    const ua = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    });
    expect(whatsappLink('41997452053').startsWith('whatsapp://send?')).toBe(true);

    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(whatsappLink('41997452053').startsWith('https://wa.me/')).toBe(true);

    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
  });
});

/**
 * Simula o handler de "Enviar mensagem" — valida que falhas exibem toast pt-BR.
 */
const toastError = vi.fn();
const toastSuccess = vi.fn();

beforeEach(() => {
  toastError.mockReset();
  toastSuccess.mockReset();
});

const sendLeadHandler = (provider: { name?: string; whatsapp?: string }, ctx: { service?: string; city?: string; state?: string }) => {
  const canonical = toCanonical(provider.whatsapp || '');
  if (!canonical) {
    toastError('WhatsApp do profissional indisponível. Tente novamente em instantes.');
    return null;
  }
  const msg = buildSmartMessage(provider.name || 'profissional', ctx.service, ctx.city, ctx.state);
  const url = whatsappWebLink(canonical, msg);
  if (url === '#') {
    toastError('Não foi possível montar o link do WhatsApp.');
    return null;
  }
  toastSuccess('Abrindo o WhatsApp...');
  return url;
};

describe('Lead/contato — handler com toast pt-BR', () => {
  it('mostra toast pt-BR quando provider não tem WhatsApp', () => {
    const out = sendLeadHandler({ name: 'Maria' }, { service: 'Encanador', city: 'Curitiba', state: 'PR' });
    expect(out).toBeNull();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringMatching(/WhatsApp do profissional indisponível/i),
    );
  });

  it('abre URL com payload completo quando dados estão ok', () => {
    const url = sendLeadHandler(
      { name: 'João', whatsapp: '41997452053' },
      { service: 'Eletricista', city: 'São Paulo', state: 'SP' },
    );
    expect(url).toMatch(/^https:\/\/wa\.me\/5541997452053\?text=/);
    expect(decodeURIComponent(url!)).toMatch(/Eletricista/);
    expect(decodeURIComponent(url!)).toMatch(/São Paulo\/SP/);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/Abrindo o WhatsApp/i));
  });
});
