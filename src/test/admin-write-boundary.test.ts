/**
 * FASE 1.6.7 — Canonical admin write boundary.
 * Static-source regression tests guaranteeing admin call-sites delegate to
 * the boundary helper and bulk operations remain intact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

// ---- Mocks for runtime tests ----
const updateMock = vi.fn(() => Promise.resolve({ error: null }));
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (..._args: any[]) => ({ eq: (...e: any[]) => (eqMock as any)(...e) }),
    })),
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'admin-1' } } })) },
  },
}));
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('@/lib/multiWriteSync', async () => {
  const actual = await vi.importActual<any>('@/lib/multiWriteSync');
  return {
    ...actual,
    logSyncFailure: vi.fn(() => Promise.resolve(undefined)),
    showPartialSyncError: vi.fn(),
  };
});

beforeEach(() => {
  updateMock.mockClear();
  eqMock.mockClear();
  eqMock.mockImplementation(() => Promise.resolve({ error: null }));
});

describe('FASE 1.6.7 · adminWriteBoundary helper', () => {
  it('normalizeAdminWritePayload normaliza phone/whatsapp e preserva demais campos', async () => {
    const { normalizeAdminWritePayload } = await import('@/lib/adminWriteBoundary');
    const out = normalizeAdminWritePayload('profile', {
      full_name: 'Maria',
      phone: '(11) 91234-5678',
      whatsapp: '(11) 91234-5678',
      status: 'active',
    });
    expect(out.full_name).toBe('Maria');
    expect(out.status).toBe('active');
    expect(out.phone).toMatch(/^\d{10,11}$/);
    expect(out.whatsapp).toMatch(/^\d{10,11}$/);
  });

  it('updateAdminProfile retorna ok:true em sucesso e ok:false sem throw em erro', async () => {
    const { updateAdminProfile } = await import('@/lib/adminWriteBoundary');
    const ok = await updateAdminProfile({
      userId: 'u1', source: 'test:ok', patch: { status: 'active' },
    });
    expect(ok.ok).toBe(true);

    eqMock.mockImplementationOnce(() => Promise.resolve({ error: { code: '23505', message: 'dup' } }));
    const fail = await updateAdminProfile({
      userId: 'u1', source: 'test:fail', patch: { status: 'active' },
    });
    expect(fail.ok).toBe(false);
    expect(fail.error?.code).toBe('23505');
  });

  it('runAdminMultiWrite para na primeira falha e marca snapshot', async () => {
    const { runAdminMultiWrite } = await import('@/lib/adminWriteBoundary');
    const res = await runAdminMultiWrite({
      source: 'test:multi',
      steps: [
        { step: 'profile', run: async () => ({ ok: true }) },
        { step: 'provider', run: async () => ({ ok: false, error: { code: 'X', message: 'no' } }) },
        { step: 'service', run: async () => { throw new Error('must not run'); } },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.snapshot.failed_step).toBe('provider');
    expect(res.snapshot.profile_updated).toBe(true);
  });
});

describe('FASE 1.6.7 · UserDetailSheet delega à boundary', () => {
  const src = read('src/components/admin/UserDetailSheet.tsx');

  it('saveProfile / saveProvider / updateField usam o helper canônico', () => {
    expect(src).toMatch(/admin_user_detail_sheet:save_profile/);
    expect(src).toMatch(/admin_user_detail_sheet:save_provider/);
    expect(src).toMatch(/admin_user_detail_sheet:inline/);
    expect(src).toMatch(/updateAdminProfile/);
    expect(src).toMatch(/updateAdminProvider/);
  });

  it('moderation (suspend/ban/reactivate) usa updateAdminProfile', () => {
    expect(src).toMatch(/admin_user_detail_sheet:suspend/);
    expect(src).toMatch(/admin_user_detail_sheet:ban/);
    expect(src).toMatch(/admin_user_detail_sheet:reactivate/);
  });

  it('avatar continua usando @/lib/avatarSync (Fase 1.6.4)', () => {
    expect(src).toMatch(/@\/lib\/avatarSync/);
  });
});

describe('FASE 1.6.7 · ProviderEditDialog delega à boundary', () => {
  const src = read('src/components/admin/ProviderEditDialog.tsx');
  it('handleSave usa updateAdminProvider', () => {
    expect(src).toMatch(/admin_provider_edit_dialog:save/);
    expect(src).toMatch(/updateAdminProvider/);
  });
});

describe('FASE 1.6.7 · AdminUsersPage delega single-user paths', () => {
  const src = read('src/pages/AdminUsersPage.tsx');
  it('handleBlock e handleDelete usam updateAdminProfile', () => {
    expect(src).toMatch(/admin_users_page:block_toggle/);
    expect(src).toMatch(/admin_users_page:soft_delete/);
  });
  it('bulk paths NÃO usam o helper (preserva semântica .in())', () => {
    // bulk continua usando supabase.from('profiles').update(...).in('id', ids)
    expect(src).toMatch(/from\(['"]profiles['"]\)\.update[\s\S]{0,200}\.in\(['"]id['"]/);
  });
});

describe('FASE 1.6.7 · AdminProvidersPage delega single + preserva bulk', () => {
  const src = read('src/pages/AdminProvidersPage.tsx');
  it('updateStatus usa updateAdminProvider', () => {
    expect(src).toMatch(/admin_providers_page:update_status/);
    expect(src).toMatch(/updateAdminProvider/);
  });
  it('approveAllPending / rejectAllPending mantêm semantics bulk .in()', () => {
    expect(src).toMatch(/from\(['"]providers['"]\)\.update\(\{ status: 'approved' \}\)\.in\(/);
    expect(src).toMatch(/from\(['"]providers['"]\)\.update\(\{ status: 'rejected' \}\)\.in\(/);
  });
});

describe('FASE 1.6.7 · AdminPage legacy isolado', () => {
  const src = read('src/pages/AdminPage.tsx');
  it('marcado como LEGACY com delegação à boundary', () => {
    expect(src).toMatch(/LEGACY \(Fase 1\.6\.7\)/);
    expect(src).toMatch(/admin_page_legacy:approve_provider/);
    expect(src).toMatch(/admin_page_legacy:reject_provider/);
  });
});

describe('FASE 1.6.7 · audit action allowlist', () => {
  const src = read('src/hooks/useAuditLog.ts');
  it('inclui admin_write_boundary_failed', () => {
    expect(src).toMatch(/admin_write_boundary_failed/);
  });
});
