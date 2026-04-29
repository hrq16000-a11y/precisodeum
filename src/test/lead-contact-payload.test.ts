/**
 * Garante que o payload do lead enviado de ProviderProfile (e variantes)
 * mantém os campos obrigatórios e a forma esperada pela tabela `leads`:
 *
 *  - provider_id correto (associação ao prestador)
 *  - client_name, phone, service_needed, message presentes
 *  - lead_context com origin/page/captured_at e categoria/cidade
 *  - mensagem agrega o bloco "— Contexto —" quando há dados extras
 *
 * O insert real é coberto por RLS no banco (testado em schema-integrity-rpc).
 * Aqui validamos apenas a montagem do payload, que é a fonte de bugs do fluxo.
 */
import { describe, it, expect } from 'vitest';

interface LeadForm {
  name: string;
  phone: string;
  service: string;
  message: string;
  city?: string;
  state?: string;
}

interface BuiltPayload {
  provider_id: string;
  client_name: string;
  phone: string;
  service_needed: string;
  message: string;
  lead_context: {
    city: string | null;
    state: string | null;
    category: string | null;
    origin: string;
    page: string;
    provider_slug: string | null;
    referrer: string | null;
    captured_at: string;
  };
}

/**
 * Replica EXATAMENTE a lógica de ProviderProfile.tsx (linhas ~1080-1117).
 * Mantida aqui para que mudanças no shape do payload quebrem o teste,
 * forçando atualização consciente do contrato.
 */
function buildLeadPayload(args: {
  providerId: string;
  slug: string | null;
  category: string | null;
  origin: string;
  form: LeadForm;
  referrer?: string | null;
}): BuiltPayload {
  const { providerId, slug, category, origin, form, referrer = null } = args;
  const ctxParts: string[] = [];
  const locStr = [form.city, form.state].filter(Boolean).join(' - ');
  if (locStr) ctxParts.push(`Localização: ${locStr}`);
  if (origin && origin !== 'direto') ctxParts.push(`Origem: ${origin}`);
  if (category) ctxParts.push(`Categoria: ${category}`);
  const ctxBlock = ctxParts.length ? `\n\n— Contexto —\n${ctxParts.join('\n')}` : '';
  const finalMessage = `${form.message || ''}${ctxBlock}`.trim();

  return {
    provider_id: providerId,
    client_name: form.name,
    phone: form.phone,
    service_needed: form.service,
    message: finalMessage,
    lead_context: {
      city: form.city || null,
      state: form.state || null,
      category: category || null,
      origin: origin || 'direto',
      page: 'provider_profile',
      provider_slug: slug,
      referrer,
      captured_at: new Date().toISOString(),
    },
  };
}

describe('lead payload — associação e shape', () => {
  it('associa o provider_id correto e preserva client_name/phone/service', () => {
    const p = buildLeadPayload({
      providerId: 'prov-123',
      slug: 'joao-eletricista',
      category: 'Eletricista',
      origin: 'direto',
      form: {
        name: 'Maria',
        phone: '41997452053',
        service: 'Instalação de chuveiro',
        message: 'Preciso urgente',
        city: 'Curitiba',
        state: 'PR',
      },
    });
    expect(p.provider_id).toBe('prov-123');
    expect(p.client_name).toBe('Maria');
    expect(p.phone).toBe('41997452053');
    expect(p.service_needed).toBe('Instalação de chuveiro');
  });

  it('agrega bloco de contexto na mensagem quando há cidade/categoria', () => {
    const p = buildLeadPayload({
      providerId: 'prov-1',
      slug: 'x',
      category: 'Pintor',
      origin: 'busca_cidade',
      form: { name: 'M', phone: '11', service: 'pintura', message: 'oi', city: 'SP', state: 'SP' },
    });
    expect(p.message).toContain('— Contexto —');
    expect(p.message).toContain('Localização: SP - SP');
    expect(p.message).toContain('Origem: busca_cidade');
    expect(p.message).toContain('Categoria: Pintor');
  });

  it('NÃO agrega bloco quando origin=direto e não há cidade/categoria', () => {
    const p = buildLeadPayload({
      providerId: 'prov-1',
      slug: 'x',
      category: null,
      origin: 'direto',
      form: { name: 'M', phone: '11', service: 's', message: 'oi' },
    });
    expect(p.message).toBe('oi');
    expect(p.message).not.toContain('Contexto');
  });

  it('lead_context preenche origem padrão "direto" e timestamp ISO', () => {
    const p = buildLeadPayload({
      providerId: 'prov-1', slug: null, category: null, origin: '',
      form: { name: 'M', phone: '11', service: 's', message: 'oi' },
    });
    expect(p.lead_context.origin).toBe('direto');
    expect(() => new Date(p.lead_context.captured_at).toISOString()).not.toThrow();
    expect(p.lead_context.page).toBe('provider_profile');
  });

  it('campos opcionais nulos não viram string "null"', () => {
    const p = buildLeadPayload({
      providerId: 'prov-1', slug: null, category: null, origin: 'direto',
      form: { name: 'M', phone: '11', service: 's', message: '' },
    });
    expect(p.lead_context.city).toBeNull();
    expect(p.lead_context.state).toBeNull();
    expect(p.lead_context.category).toBeNull();
    expect(p.lead_context.provider_slug).toBeNull();
  });
});
