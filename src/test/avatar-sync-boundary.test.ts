/**
 * Fase 1.6.4 — Tests for canonical avatar write boundary.
 *
 * Cenários:
 *   A) Usuário sem provider → só profiles.avatar_url
 *   B) Provider → profiles.avatar_url + providers.photo_url
 *   C) provider.photo_url falha → ok=false + audit
 *   D) Admin path usa helper (smoke: imports + chama setUserAvatar)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----
const profilesUpdate = vi.fn();
const providersUpdate = vi.fn();
const providersSelect = vi.fn();
const auditInsert = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          update: (patch: any) => {
            profilesUpdate(patch);
            return { eq: () => Promise.resolve({ error: profilesUpdate.mock.results.at(-1)?.value?.error ?? null }) };
          },
        };
      }
      if (table === 'providers') {
        return {
          update: (patch: any) => {
            providersUpdate(patch);
            return { eq: () => Promise.resolve({ error: providersUpdate.mock.results.at(-1)?.value?.error ?? null }) };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(providersSelect()),
            }),
          }),
        };
      }
      if (table === 'audit_log') {
        return { insert: (row: any) => { auditInsert(row); return Promise.resolve({ error: null }); } };
      }
      return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

import { setUserAvatar, resolveAvatarWriteTargets } from '@/lib/avatarSync';

describe('avatarSync — canonical write boundary', () => {
  beforeEach(() => {
    profilesUpdate.mockReset();
    providersUpdate.mockReset();
    providersSelect.mockReset();
    auditInsert.mockReset();
  });

  it('A) usuário sem provider: só profiles.avatar_url é atualizado', async () => {
    providersSelect.mockReturnValue({ data: null });
    const res = await setUserAvatar({ userId: 'u1', url: 'https://x/a.jpg', source: 'avatar_upload_component' });
    expect(res.ok).toBe(true);
    expect(res.profileUpdated).toBe(true);
    expect(res.providerUpdated).toBe(false);
    expect(profilesUpdate).toHaveBeenCalledWith({ avatar_url: 'https://x/a.jpg' });
    expect(providersUpdate).not.toHaveBeenCalled();
  });

  it('B) provider: atualiza profiles.avatar_url + providers.photo_url', async () => {
    providersSelect.mockReturnValue({ data: { id: 'p1' } });
    const res = await setUserAvatar({ userId: 'u1', url: 'https://x/b.jpg', source: 'dashboard_profile_page' });
    expect(res.ok).toBe(true);
    expect(res.profileUpdated).toBe(true);
    expect(res.providerUpdated).toBe(true);
    expect(profilesUpdate).toHaveBeenCalledWith({ avatar_url: 'https://x/b.jpg' });
    expect(providersUpdate).toHaveBeenCalledWith({ photo_url: 'https://x/b.jpg' });
  });

  it('B.2) providerId fornecido evita lookup extra', async () => {
    const res = await setUserAvatar({
      userId: 'u1', url: 'https://x/b2.jpg', source: 'onboarding_v2_shell', providerId: 'p99',
    });
    expect(res.providerUpdated).toBe(true);
    expect(providersSelect).not.toHaveBeenCalled();
  });

  it('C) provider.photo_url falha → ok=false + audit log emitido', async () => {
    providersSelect.mockReturnValue({ data: { id: 'p1' } });
    providersUpdate.mockReturnValueOnce({ error: { message: 'rls denied' } });
    const res = await setUserAvatar({ userId: 'u1', url: 'https://x/c.jpg', source: 'admin_user_detail_sheet', silent: true });
    expect(res.ok).toBe(false);
    expect(res.failedStep).toBe('provider');
    expect(res.profileUpdated).toBe(true);
    expect(auditInsert).toHaveBeenCalled();
    const row = auditInsert.mock.calls[0][0];
    expect(row.action).toBe('avatar_sync_failed');
    expect(row.resource_type).toBe('multi_write_sync');
    expect(row.details.source).toBe('admin_user_detail_sheet');
    // sem PII
    expect(JSON.stringify(row.details)).not.toContain('https://x/c.jpg');
  });

  it('C.2) profile.avatar_url falha → failedStep=profile', async () => {
    profilesUpdate.mockReturnValueOnce({ error: { message: 'unique violation' } });
    providersSelect.mockReturnValue({ data: null });
    const res = await setUserAvatar({ userId: 'u1', url: 'https://x/d.jpg', source: 'other', silent: true });
    expect(res.ok).toBe(false);
    expect(res.failedStep).toBe('profile');
  });

  it('D) resolveAvatarWriteTargets retorna provider flag correto', async () => {
    providersSelect.mockReturnValue({ data: { id: 'p7' } });
    const t = await resolveAvatarWriteTargets('u1');
    expect(t).toEqual({ profile: true, provider: true, providerId: 'p7' });
  });

  it('D.2) syncProvider=false NÃO toca providers', async () => {
    providersSelect.mockReturnValue({ data: { id: 'p1' } });
    const res = await setUserAvatar({ userId: 'u1', url: 'https://x/e.jpg', source: 'other', syncProvider: false });
    expect(res.providerUpdated).toBe(false);
    expect(providersUpdate).not.toHaveBeenCalled();
  });
});
