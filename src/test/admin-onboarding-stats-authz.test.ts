/**
 * Autorização da página /admin/onboarding-stats e da RPC
 * `admin_review_anchor_audit`.
 *
 * Cobre 3 invariantes de segurança:
 *  1. A rota /admin/onboarding-stats é registrada no App envolvida em
 *     <AdminGuard> — NUNCA exposta direto.
 *  2. A guarda RPC no SQL grita `forbidden` quando `has_role(admin)`
 *     retorna false (validamos o contrato lido pela página).
 *  3. As queries da página estão configuradas com `enabled: !!isAdmin`
 *     — sem flag de admin, NENHUMA RPC é despachada.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const APP_TSX = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const PAGE_TSX = readFileSync(
  join(root, 'src/pages/admin/AdminOnboardingStatsPage.tsx'),
  'utf8',
);
const MIGRATION = readFileSync(
  join(
    root,
    'supabase/migrations/20260502014406_78311fd8-37d0-487f-b451-bad3d0316305.sql',
  ),
  'utf8',
);

describe('admin/onboarding-stats — autorização', () => {
  it('rota /admin/onboarding-stats está envolvida por <AdminGuard>', () => {
    // Match exige AdminGuard no element prop. Permite quebra de linha entre
    // path e element para tolerar formatadores.
    const re =
      /path=["']\/admin\/onboarding-stats["']\s+element=\{<AdminGuard>[^}]*<\/AdminGuard>\}/;
    expect(re.test(APP_TSX)).toBe(true);
  });

  it('todas as RPCs da página estão atrás de `enabled: !!isAdmin`', () => {
    // Conta quantas useQuery declaram queryKey de admin-* e quantas têm
    // o gating. Devem ser iguais — qualquer query nova precisa do mesmo
    // fence de segurança.
    const queries = PAGE_TSX.match(/useQuery\(\{[\s\S]*?\}\)/g) || [];
    const adminQueries = queries.filter((q) =>
      /queryKey:\s*\[\s*["']admin-/.test(q),
    );
    expect(adminQueries.length).toBeGreaterThanOrEqual(4);
    for (const q of adminQueries) {
      expect(q).toMatch(/enabled:\s*!!isAdmin/);
    }
  });

  it('a query da auditoria chama exatamente admin_review_anchor_audit', () => {
    expect(PAGE_TSX).toMatch(
      /supabase\.rpc[\s\S]{0,80}['"]admin_review_anchor_audit['"]/,
    );
  });

  it('a RPC SQL aborta com `forbidden` quando o caller não é admin', () => {
    expect(MIGRATION).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'\s*\)/);
    expect(MIGRATION).toMatch(/RAISE EXCEPTION 'forbidden'/);
  });

  it('a RPC SQL revoga PUBLIC e concede só a authenticated', () => {
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_review_anchor_audit\(integer\) FROM PUBLIC/,
    );
    expect(MIGRATION).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_review_anchor_audit\(integer\) TO authenticated/,
    );
  });

  it('a RPC SQL é SECURITY DEFINER com search_path fixo (anti-hijack)', () => {
    expect(MIGRATION).toMatch(/SECURITY DEFINER/);
    expect(MIGRATION).toMatch(/SET search_path = public/);
  });
});
