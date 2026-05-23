import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recordSponsorClick,
  getActiveSponsorRef,
  __resetSponsorAttribution,
} from '@/lib/sponsorAttribution';

describe('sponsorAttribution', () => {
  beforeEach(() => {
    __resetSponsorAttribution();
    vi.useRealTimers();
  });

  it('persists clique and exposes sponsor_id na mesma sessão', () => {
    recordSponsorClick('11111111-1111-1111-1111-111111111111', 'hero-top');
    expect(getActiveSponsorRef()).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('expira após 30 minutos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T10:00:00Z'));
    recordSponsorClick('aaaa', 'card');
    vi.setSystemTime(new Date('2026-05-23T10:31:00Z'));
    expect(getActiveSponsorRef()).toBeNull();
  });

  it('ignora sponsor_id vazio', () => {
    recordSponsorClick('', 'banner');
    expect(getActiveSponsorRef()).toBeNull();
  });

  it('última atribuição vence (last-write-wins)', () => {
    recordSponsorClick('aaaa', 'hero-top');
    recordSponsorClick('bbbb', 'sidebar');
    expect(getActiveSponsorRef()).toBe('bbbb');
  });
});
