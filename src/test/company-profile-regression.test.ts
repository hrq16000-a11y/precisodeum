import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPANY_PROFILE = readFileSync(resolve(__dirname, '../pages/CompanyProfile.tsx'), 'utf8');

describe('CompanyProfile regression guard', () => {
  it('não consulta colunas removidas do schema de providers', () => {
    expect(COMPANY_PROFILE).not.toContain('founded_year');
    expect(COMPANY_PROFILE).not.toContain('team_size');
  });

  it('mantém fallback por UUID e redirecionamento para slug canônica', () => {
    expect(COMPANY_PROFILE).toContain('const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);');
    expect(COMPANY_PROFILE).toMatch(/navigate\(`\/empresa\/\$\{company\.slug\}`\s*,\s*\{ replace: true \}\)/);
  });
});