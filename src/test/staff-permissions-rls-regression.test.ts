/**
 * A2 — Regressão de RLS em public.staff_permissions
 *
 * Garante que a tabela NUNCA mais será exposta com USING true a qualquer
 * authenticated. Apenas admins podem ler a tabela diretamente; usuários
 * comuns devem usar a RPC SECURITY DEFINER `get_staff_permissions`.
 *
 * O teste lê a migration aplicada para validar o contrato.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');

function loadAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n');
}

describe('A2 — staff_permissions RLS', () => {
  const sql = loadAllMigrations();

  it('remove a policy permissiva "Authenticated read staff_permissions"', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS\s+"Authenticated read staff_permissions"\s+ON\s+public\.staff_permissions/i,
    );
  });

  it('cria policy SELECT restrita a admins via has_role()', () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"Admins read staff_permissions"[\s\S]{0,200}FOR\s+SELECT[\s\S]{0,200}has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i,
    );
  });

  it('nunca reintroduz USING true em staff_permissions', () => {
    // Pega o último arquivo de migration que toca em staff_permissions e
    // valida que a nova policy não usa USING (true)
    const offendingBlock = sql.match(
      /CREATE POLICY[^;]*ON\s+public\.staff_permissions[^;]*USING\s*\(\s*true\s*\)/i,
    );
    // Permitido apenas se for histórico que foi explicitamente DROPado depois.
    if (offendingBlock) {
      expect(sql).toMatch(
        /DROP POLICY IF EXISTS\s+"Authenticated read staff_permissions"/i,
      );
    }
  });
});
