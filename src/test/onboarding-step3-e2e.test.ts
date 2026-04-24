/**
 * E2E-style assertions garantindo que `tax_id` (CPF/CNPJ) NUNCA escape
 * para páginas públicas, e que o Passo 3 do wizard preserva o contrato
 * de "documento opcional" + skip funcional + cidade selecionável.
 *
 * Esses checks rodam contra a árvore de código real (sem precisar subir o app)
 * — qualquer regressão na blindagem ou no fluxo quebra o build imediatamente.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { execSync } from 'child_process';

const read = (path: string) => fs.readFileSync(path, 'utf8');

const listSourceFiles = () => {
  const out = execSync(
    "find src -type f \\( -name '*.ts' -o -name '*.tsx' \\) -not -path 'src/integrations/supabase/types.ts' -not -path 'src/test/*'",
    { encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
};

describe('Privacidade do tax_id (CPF/CNPJ)', () => {
  const allFiles = listSourceFiles();

  it('Nenhuma página pública faz select direto de tax_id em profiles', () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const src = read(file);
      // Permite apenas o wizard e dashboards/admin de fazerem leitura via RPC dedicada.
      if (file.includes('SmartOnboardingWizard')) continue;
      // Bloqueia qualquer .select(... 'tax_id' ...) — a leitura deve passar pela RPC segura.
      const hasSelectTaxId =
        /\.select\([^)]*tax_id[^)]*\)/.test(src) ||
        /select\([^)]*'\*'[^)]*\)\.from\(['"]profiles['"]/.test(src);
      if (hasSelectTaxId) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('Acesso ao documento completo é exclusivamente via RPC `get_profile_tax_id`', () => {
    const wizard = read('src/components/onboarding/SmartOnboardingWizard.tsx');
    expect(wizard).toMatch(/supabase\.rpc\(['"]get_profile_tax_id['"]/);
    expect(wizard).toMatch(/supabase\.rpc\(['"]set_profile_tax_id['"]/);
    // Não pode haver UPDATE direto na coluna tax_id pelo cliente — sempre via RPC
    // (a RPC criptografa e mantém last4/kind sincronizados).
    expect(wizard).not.toMatch(/from\(['"]profiles['"]\)[\s\S]{0,200}update\(\{[\s\S]{0,300}tax_id:/);
  });

  it('Nenhum componente público (lista/detail de prestador) referencia tax_id', () => {
    const publicPages = [
      'src/pages/ProvidersPage.tsx',
      'src/pages/ProfessionalProfilePage.tsx',
    ].filter((f) => fs.existsSync(f));
    for (const file of publicPages) {
      expect(read(file)).not.toMatch(/tax_id/);
    }
  });
});

describe('Passo 3 do wizard — contratos de UI', () => {
  const wizard = read('src/components/onboarding/SmartOnboardingWizard.tsx');

  it('campo CPF/CNPJ tem badge "Documento opcional"', () => {
    expect(wizard).toContain('Documento opcional');
  });

  it('botão de pular existe e só renderiza quando o documento está vazio', () => {
    expect(wizard).toMatch(/!taxFilled[\s\S]{0,400}Pular passo agora/);
  });

  it('botão principal mostra estado "Salvando…" e label dinâmico', () => {
    expect(wizard).toMatch(/saving[\s\S]{0,80}Salvando…/);
    expect(wizard).toContain('Salvar dados e continuar');
    expect(wizard).toContain('Continuar (documento depois)');
  });

  it('feedback verde "salvo com segurança" aparece após persistir o documento', () => {
    expect(wizard).toMatch(/taxSavedFeedback[\s\S]{0,200}salvo com segurança/);
    expect(wizard).toMatch(/setTaxIdJustSaved\(true\)/);
  });

  it('botão "Voltar" não dispara reset de campos (estado é preservado por React state)', () => {
    // A regra é: onBack apenas chama advanceTo(2). Nada de setTaxId('') ou similar.
    expect(wizard).toMatch(/onBack=\{\(\) => advanceTo\(2\)\}/);
    expect(wizard).not.toMatch(/onBack=\{[^}]*setTaxId\(['"]{2}\)/);
  });
});

describe('CityAutocomplete — fluxo de seleção', () => {
  const wizard = read('src/components/onboarding/SmartOnboardingWizard.tsx');
  const autocomplete = read('src/components/CityAutocomplete.tsx');

  it('ao selecionar uma cidade, o popover fecha automaticamente', () => {
    expect(autocomplete).toMatch(/onSelect=\{\(\)\s*=>\s*\{[\s\S]{0,200}setOpen\(false\)/);
  });

  it('ao selecionar a cidade, o modo "editingCity" do wizard é encerrado', () => {
    expect(wizard).toMatch(/onCityChange=\{[\s\S]{0,200}setEditingCity\(false\)/);
  });

  it('display do autocomplete usa safeUF para evitar lixo como "St"/"Sa"', () => {
    expect(autocomplete).toContain('safeUF(value.state)');
  });

  it('useGeoCity.normalizeUF não inventa UF de 2 letras a partir de string desconhecida', () => {
    const geo = read('src/hooks/useGeoCity.ts');
    expect(geo).not.toMatch(/trimmed\.toUpperCase\(\)\.slice\(0,\s*2\)/);
    expect(geo).toMatch(/STATE_NAME_TO_UF\[lower\]\s*\|\|\s*null/);
  });
});
