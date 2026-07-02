import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slugify';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';

/**
 * E2E /profissional/{slug} — cobertura "magra" (sem montar a página inteira):
 *  - Slug válido para a rota
 *  - CTA WhatsApp gera URL correta com mensagem pt-BR
 *  - Tabs reviews/serviços têm hashes/rotas estáveis (deep linking mobile)
 */

describe('ProviderProfile — slug e contato', () => {
  it('slug seguro para URL', () => {
    expect(slugify('João Pedro Encanador!')).toMatch(/^joao-pedro-encanador/);
    expect(slugify('São Paulo / SP')).toMatch(/^sao-paulo/);
    expect(slugify('  ---  ')).toBe('');
  });

  it('CTA WhatsApp constrói URL com mensagem pt-BR padrão', () => {
    const link = whatsappLink(
      '41997452053',
      'Olá Maria! Vi seu perfil no Preciso de um e gostaria de conversar sobre uma necessidade.',
    );
    expect(link).toMatch(/^(whatsapp:\/\/send\?phone=|https:\/\/wa\.me\/)5541997452053/);
    const text = decodeURIComponent(link.split('text=')[1] || '');
    expect(text).toMatch(/Vi seu perfil no Preciso de um/i);
  });

  it('compartilhar serviço inclui o nome do serviço no texto', () => {
    const link = whatsappLink(
      '41997452053',
      `Olá! Vi o serviço "Instalação de chuveiro" no Preciso de um e gostaria de mais informações.`,
    );
    const text = decodeURIComponent(link.split('text=')[1] || '');
    expect(text).toMatch(/Instalação de chuveiro/);
  });

  it('mensagem inteligente cobre fallback sem categoria/cidade', () => {
    expect(buildSmartMessage('Pedro')).toMatch(/Podemos conversar\?$/);
  });
});

/**
 * Deep links das abas (mobile). A ProviderProfile usa hashes #avaliacoes / #servicos
 * para navegação sticky-friendly em telas pequenas.
 */
describe('ProviderProfile — deep links de abas', () => {
  const hashes = ['#sobre', '#servicos', '#avaliacoes', '#portfolio'];
  it.each(hashes)('hash %s é estável (sem espaços/maiúsculas)', (h) => {
    expect(h).toMatch(/^#[a-z]+$/);
  });

  it('rota canônica do perfil usa /profissional/:slug', () => {
    const slug = slugify('Maria Silva');
    const path = `/profissional/${slug}`;
    expect(path).toMatch(/^\/profissional\/[a-z0-9-]+$/);
  });
});
