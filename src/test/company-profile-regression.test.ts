import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sanitizeSlug } from '@/lib/slugify';
import { whatsappLink } from '@/lib/whatsapp';

const COMPANY_PROFILE = readFileSync(resolve(__dirname, '../pages/CompanyProfile.tsx'), 'utf8');

describe('CompanyProfile regression guard', () => {
  it('não consulta colunas removidas do schema de providers', () => {
    expect(COMPANY_PROFILE).not.toContain('founded_year');
    expect(COMPANY_PROFILE).not.toContain('team_size');
    expect(COMPANY_PROFILE).not.toContain('display_name');
  });

  it('mantém fallback por UUID e redirecionamento para slug canônica', () => {
    expect(COMPANY_PROFILE).toContain('const isUuid = UUID_RE.test(param);');
    expect(COMPANY_PROFILE).toMatch(/navigate\(`\/empresa\/\$\{company\.slug\}`\s*,\s*\{ replace: true \}\)/);
  });

  it('publica canonical e JSON-LD da rota canônica de empresa', () => {
    expect(COMPANY_PROFILE).toContain('canonical: company?.slug ? `${SITE_BASE_URL}/empresa/${company.slug}` : undefined');
    expect(COMPANY_PROFILE).toContain("'@type': 'BreadcrumbList'");
    expect(COMPANY_PROFILE).toContain("'@type': ['Organization', 'LocalBusiness']");
  });

  it('usa solicitação de contato + gate de WhatsApp sem expor telefone bruto', () => {
    expect(COMPANY_PROFILE).toContain('Solicitar contato');
    expect(COMPANY_PROFILE).toContain('requestWhatsApp({');
    expect(COMPANY_PROFILE).not.toContain('href={`tel:${company.phone}`}');
  });
});

describe('CompanyProfile helpers', () => {
  it('sanitiza slugs para o padrão canônico', () => {
    expect(sanitizeSlug('Altemir Rocha de Almeida Junior')).toBe('altemir-rocha-de-almeida-junior');
  });

  it('gera URL de WhatsApp válida para o gate', () => {
    const url = whatsappLink('5542999189227', 'Olá empresa, gostaria de solicitar contato.');
    expect(url).toMatch(/(wa\.me|whatsapp:\/\/send)/);
  });
});