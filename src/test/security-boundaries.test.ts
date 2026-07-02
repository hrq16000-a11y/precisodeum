import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('security boundaries', () => {
  it.each([
    'supabase/functions/batch-optimize-images/index.ts',
    'supabase/functions/sync-storage-media/index.ts',
  ])('%s requires an authenticated administrator', (path) => {
    const source = read(path);
    expect(source).toContain('auth.getUser()');
    expect(source).toContain("_role: 'admin'");
    expect(source).toContain("error: 'Forbidden'");
  });

  it('image optimization enforces path ownership for non-admin users', () => {
    const source = read('supabase/functions/optimize-image/index.ts');
    expect(source).toContain('const ownsPath');
    expect(source).toContain('!isAdmin && !ownsPath(path)');
    expect(source).toContain('!isAdmin && (!folder || !ownsPath(folder))');
  });

  it('push notification writes validate administrator authorization', () => {
    const source = read('supabase/functions/push-notifications/index.ts');
    expect(source).toContain('callerClient.auth.getUser()');
    expect(source).toContain('_role: "admin"');
    expect(source).toContain('if (!authorized)');
  });

  it('Vault secret helper is not executable by API roles', () => {
    const source = read('supabase/migrations/20260702000000_restrict_vault_secret_function.sql');
    expect(source).toContain('FROM PUBLIC');
    expect(source).toContain('FROM anon');
    expect(source).toContain('FROM authenticated');
  });
});
