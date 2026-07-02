/**
 * FASE 1.6.2 — Hardening Admin Write Paths.
 * Testes de regressão para garantir que os helpers de validação
 * (Fase 1.2/1.3) estão aplicados nos caminhos administrativos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('FASE 1.6.2 · UserDetailSheet hardening', () => {
  const src = read('src/components/admin/UserDetailSheet.tsx');

  it('importa helpers de fullName e phone', () => {
    expect(src).toMatch(/from ['"]@\/lib\/validation\/fullNameValidation['"]/);
    expect(src).toMatch(/from ['"]@\/lib\/validation\/phoneNormalization['"]/);
  });

  it('saveProfile usa shouldEnforceFullName e isValidFullName', () => {
    expect(src).toMatch(/shouldEnforceFullName\(\s*profileForm\.full_name/);
    expect(src).toMatch(/isValidFullName\(\s*profileForm\.full_name/);
  });

  it('saveProfile valida whatsapp e phone com shouldEnforcePhone', () => {
    expect(src).toMatch(/shouldEnforcePhone\(rawWhatsapp/);
    expect(src).toMatch(/shouldEnforcePhone\(rawPhone/);
  });

  it('saveProvider valida phone/whatsapp e canonicaliza com normalizePhoneBR', () => {
    expect(src).toMatch(/normalizePhoneBR\(rawWhatsapp\)/);
    expect(src).toMatch(/normalizePhoneBR\(rawPhone\)/);
  });

  it('emite audit log admin_validation_blocked sem PII', () => {
    expect(src).toMatch(/admin_validation_blocked/);
    // Garante que não loga o valor cru do nome/whatsapp
    expect(src).not.toMatch(/details:\s*\{[^}]*value:\s*profileForm\.full_name/);
    expect(src).not.toMatch(/details:\s*\{[^}]*raw:\s*rawWhatsapp/);
  });

  it('inputs expõem aria-invalid + aria-describedby', () => {
    expect(src).toMatch(/aria-invalid=\{!!profileNameError\}/);
    expect(src).toMatch(/aria-invalid=\{!!profileWhatsappError\}/);
    expect(src).toMatch(/aria-invalid=\{!!providerPhoneError\}/);
  });
});

describe('FASE 1.6.2 · ProviderEditDialog hardening', () => {
  const src = read('src/components/admin/ProviderEditDialog.tsx');

  it('importa helper de phone (sem regra PF de nome completo)', () => {
    expect(src).toMatch(/from ['"]@\/lib\/validation\/phoneNormalization['"]/);
    expect(src).not.toMatch(/from ['"]@\/lib\/validation\/fullNameValidation['"]/);
  });

  it('valida phone/whatsapp apenas quando muda', () => {
    expect(src).toMatch(/shouldEnforcePhone\(form\.phone,\s*prevPhone\)/);
    expect(src).toMatch(/shouldEnforcePhone\(form\.whatsapp,\s*prevWhatsapp\)/);
  });

  it('business_name é tratado de forma permissiva (apenas trim)', () => {
    expect(src).toMatch(/PJ:\s*business_name permissivo/);
    expect(src).not.toMatch(/isValidFullName\(form\.business_name/);
  });

  it('canonicaliza phone/whatsapp via normalizePhoneBR', () => {
    expect(src).toMatch(/normalizePhoneBR\(form\.phone\)/);
    expect(src).toMatch(/normalizePhoneBR\(form\.whatsapp\)/);
  });

  it('emite admin_validation_blocked para phone/whatsapp', () => {
    expect(src.match(/admin_validation_blocked/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe('FASE 1.6.2 · admin-create-user edge function', () => {
  const src = read('supabase/functions/admin-create-user/index.ts');

  it('valida full_name via isValidFullName inline', () => {
    expect(src).toMatch(/function isValidFullName/);
    expect(src).toMatch(/if \(!isValidFullName\(full_name\)\)/);
  });

  it('valida e canonicaliza whatsapp opcional', () => {
    expect(src).toMatch(/function isValidPhoneBR/);
    expect(src).toMatch(/function normalizePhoneBR/);
    expect(src).toMatch(/normalizedWhatsapp = normalizePhoneBR\(whatsapp\)/);
  });

  it('valida email via helper isValidEmail', () => {
    expect(src).toMatch(/function isValidEmail/);
    expect(src).toMatch(/if \(!isValidEmail\(email\)\)/);
  });

  it('emite audit log de criação sem PII (apenas flags booleanos)', () => {
    expect(src).toMatch(/source:\s*['"]admin_create_user['"]/);
    expect(src).toMatch(/has_whatsapp:\s*!!normalizedWhatsapp/);
    expect(src).not.toMatch(/details:\s*\{[^}]*email:\s*normalizedEmail/);
  });
});

describe('FASE 1.6.2 · AdminUsersPage bulk paths preservados', () => {
  const src = read('src/pages/AdminUsersPage.tsx');

  it('bulk status/profile_type não chamam helpers de hardening (campos não-textuais)', () => {
    // Bulk muda apenas status/profile_type/role; hardening não deve ser aplicado.
    expect(src).not.toMatch(/bulkSetStatus[\s\S]{0,400}isValidFullName/);
    expect(src).not.toMatch(/bulkChangeType[\s\S]{0,400}isValidPhoneBR/);
  });
});
