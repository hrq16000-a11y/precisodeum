import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('useAuth · regressão de colunas do profile', () => {
  it('não consulta colunas removidas do schema público e deriva fallbacks do provider', () => {
    const src = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

    expect(src).not.toMatch(/PROFILE_AUTH_COLUMNS[\s\S]*account_type,/);
    expect(src).not.toMatch(/PROFILE_AUTH_COLUMNS[\s\S]*primary_category_id,/);

    expect(src).toContain('account_type: (pData as any)?.account_type ?? derivedAccountType');
    expect(src).toContain('primary_category_id: (pData as any)?.primary_category_id ?? derivedPrimaryCategoryId');
    expect(src).toContain("pvRows.find((row: any) => row?.category_id)?.category_id");
  });
});