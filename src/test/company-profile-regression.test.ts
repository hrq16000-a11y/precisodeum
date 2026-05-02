import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMPANY_PROFILE = readFileSync(resolve(__dirname, '../pages/CompanyProfile.tsx'), 'utf8');

describe('CompanyProfile regression guard', () => {
  it('não consulta colunas removidas do schema de providers', () => {
    expect(COMPANY_PROFILE).not.toMatch(/\bfounded_year\b/);
    expect(COMPANY_PROFILE).not.toMatch(/\bteam_size\b/);
  });

  it('mantém fallback por UUID e redirecionamento para slug canônica', () => {
    expect(COMPANY_PROFILE).toMatch(/const isUuid = \^\//);
    expect(COMPANY_PROFILE).toMatch(/navigate\(`\/empresa\/\$\{company\.slug\}`\s*,\s*\{ replace: true \}\)/);
  });
});