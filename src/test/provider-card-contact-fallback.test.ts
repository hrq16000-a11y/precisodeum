import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * BLINDAGEM — CTA de contato no ProviderCard.
 *
 * Garante que profissionais sem telefone/WhatsApp nunca fiquem com um CTA
 * "morto" (clique sem efeito) e que falhas da RPC `get_provider_contact`
 * mostrem mensagem clara em vez de silêncio.
 */
const card = readFileSync(join(process.cwd(), 'src/components/ProviderCard.tsx'), 'utf-8');
const contactLib = readFileSync(join(process.cwd(), 'src/lib/providerContact.ts'), 'utf-8');
const tracking = readFileSync(join(process.cwd(), 'src/lib/tracking.ts'), 'utf-8');

describe('ProviderCard — contato sem número', () => {
  it('esconde o CTA de WhatsApp quando a RPC confirma que não há número', () => {
    expect(card).toMatch(/setContactUnavailable\(true\)/);
    expect(card).toMatch(/\{!contactUnavailable && \(/);
  });

  it('nunca faz early-return silencioso após preventDefault', () => {
    expect(card).not.toMatch(/if \(!number\) return;/);
  });

  it('mostra toast pt-BR quando não há número cadastrado', () => {
    expect(card).toMatch(/WhatsApp indisponível/);
  });

  it('"Ver Perfil" ocupa a linha inteira quando o CTA de contato some', () => {
    expect(card).toMatch(/contactUnavailable \? 'min-w-0 flex-1 basis-0'/);
  });
});

describe('ProviderCard — fallback por ligação', () => {
  it('usa o telefone como fallback quando não há WhatsApp', () => {
    expect(card).toMatch(/setRevealedPhone\(contact\.phone\)/);
    expect(card).toMatch(/tel:\$\{/);
  });

  it('rotula o botão como "Ligar" no modo telefone', () => {
    expect(card).toMatch(/revealedPhone \? 'Ligar' : 'WhatsApp'/);
  });
});

describe('ProviderCard — erro da RPC get_provider_contact', () => {
  it('providerContact sinaliza erro em vez de devolver vazio silencioso', () => {
    expect(contactLib).toMatch(/error\?: boolean/);
    expect(contactLib).toMatch(/const FAILED[\s\S]*error: true/);
  });

  it('não cacheia resultado de falha (permite retry)', () => {
    expect(contactLib).not.toMatch(/cache\.set\(providerId, FAILED\)/);
  });

  it('card exibe toast destrutivo quando a RPC falha', () => {
    expect(card).toMatch(/contact\.error/);
    expect(card).toMatch(/Não foi possível carregar o contato/);
    expect(card).toMatch(/variant: 'destructive'/);
  });
});

describe('Tracking de conversão — rota e tipo de profissional', () => {
  it('eventos de clique incluem a rota atual', () => {
    expect(tracking).toMatch(/function conversionContext/);
    expect(tracking).toMatch(/window\.location\.pathname/);
  });

  it('card envia provider_kind (individual/company) nos cliques', () => {
    expect(card).toMatch(/provider_kind: providerKind/);
    expect(card).toMatch(/providerKind =/);
  });

  it('clique em "Ver Perfil" também é rastreado com contexto', () => {
    expect(card).toMatch(/trackProfileClick\(provider\.id, provider\.slug, trackingSource, \{ provider_kind: providerKind \}\)/);
  });
});
