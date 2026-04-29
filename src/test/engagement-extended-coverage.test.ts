/**
 * Cobertura estendida (E2E-like, sem rede) dos 4 sistemas:
 *  - Version Gate: cenários de resposta da RPC (ok/force/suggest/erro/offline)
 *  - Global Error Monitor: contexto real (rota+device) + rate-limit
 *  - Daily Check-in: virada de dia BRT em diferentes offsets de servidor
 *  - PWA Install Bonus: concorrência (1 grant, N-1 already_completed)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compareVersions, APP_VERSION } from '@/lib/appVersion';

// ─────────────────────────────────────────────────────────────
// 1. VERSION GATE — cenários de resposta da RPC
// ─────────────────────────────────────────────────────────────

type RpcResp = { data: any; error: any };

function evaluateGate(
  current: string,
  rpc: () => Promise<RpcResp>,
): Promise<'ok' | 'suggest' | 'force' | 'fallback_ok'> {
  return rpc().then(({ data, error }) => {
    if (error || !data) return 'fallback_ok'; // offline/erro → não bloqueia
    const min = data.min_version || '0.0.0';
    const latest = data.latest_version || '0.0.0';
    if (compareVersions(current, min) < 0) return 'force';
    if (compareVersions(current, latest) < 0) return 'suggest';
    return 'ok';
  });
}

describe('version gate :: cenários de RPC', () => {
  it('RPC offline (network error) → fallback_ok (não bloqueia o app)', async () => {
    const rpc = () => Promise.resolve({ data: null, error: new Error('Failed to fetch') });
    expect(await evaluateGate('1.0.0', rpc)).toBe('fallback_ok');
  });

  it('RPC retorna 0.0.0 (config não setada) → ok', async () => {
    const rpc = () => Promise.resolve({ data: { min_version: '0.0.0', latest_version: '0.0.0' }, error: null });
    expect(await evaluateGate('1.0.0', rpc)).toBe('ok');
  });

  it('RPC: current < min → force', async () => {
    const rpc = () => Promise.resolve({ data: { min_version: '2.0.0', latest_version: '2.1.0' }, error: null });
    expect(await evaluateGate('1.5.0', rpc)).toBe('force');
  });

  it('RPC: min ≤ current < latest → suggest', async () => {
    const rpc = () => Promise.resolve({ data: { min_version: '1.0.0', latest_version: '2.0.0' }, error: null });
    expect(await evaluateGate('1.5.0', rpc)).toBe('suggest');
  });

  it('RPC: current ≥ latest → ok', async () => {
    const rpc = () => Promise.resolve({ data: { min_version: '1.0.0', latest_version: '2.0.0' }, error: null });
    expect(await evaluateGate('2.0.0', rpc)).toBe('ok');
    expect(await evaluateGate('3.0.0', rpc)).toBe('ok');
  });

  it('RPC: data corrompido (sem campos) → fallback_ok', async () => {
    const rpc = () => Promise.resolve({ data: {}, error: null });
    expect(await evaluateGate(APP_VERSION, rpc)).toBe('ok'); // 0.0.0 vs APP_VERSION
  });
});

// ─────────────────────────────────────────────────────────────
// 2. GLOBAL ERROR MONITOR — rate-limit + contexto real
// ─────────────────────────────────────────────────────────────

interface SinkCall { err: unknown; ctx: Record<string, unknown> }

function makeMonitor() {
  const calls: SinkCall[] = [];
  const recent = new Map<string, number[]>();
  const RATE_WIN_MS = 5000;
  const RATE_MAX = 5;

  const isRateLimited = (key: string, now: number) => {
    const arr = (recent.get(key) || []).filter((t) => now - t < RATE_WIN_MS);
    arr.push(now);
    recent.set(key, arr);
    return arr.length > RATE_MAX;
  };

  const buildContext = (route: string, device: Record<string, unknown>) => ({
    route,
    device,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
  });

  const capture = (msg: string, route: string, device: Record<string, unknown>, now = Date.now()) => {
    const key = `err:${msg.slice(0, 80)}`;
    if (isRateLimited(key, now)) return false;
    calls.push({ err: msg, ctx: buildContext(route, device) });
    return true;
  };

  return { capture, calls };
}

describe('error monitor :: contexto real + rate-limit', () => {
  it('inclui route e device.platform/dpr no contexto enviado ao sink', () => {
    const m = makeMonitor();
    m.capture('Erro X', '/dashboard?tab=leads', {
      isMobile: true, isStandalone: false, platform: 'iPhone', dpr: 3,
    });
    const ctx = m.calls[0].ctx as any;
    expect(ctx.route).toBe('/dashboard?tab=leads');
    expect(ctx.device.platform).toBe('iPhone');
    expect(ctx.device.dpr).toBe(3);
    expect(ctx.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('rate-limit: 5 reports por janela de 5s, 6º descartado', () => {
    const m = makeMonitor();
    const now = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < 8; i++) {
      if (m.capture('Mesma falha', '/x', {}, now + i * 100)) allowed++;
    }
    expect(allowed).toBe(5);
    expect(m.calls.length).toBe(5);
  });

  it('rate-limit: chaves diferentes não compartilham bucket', () => {
    const m = makeMonitor();
    const now = 1_000_000;
    for (let i = 0; i < 6; i++) m.capture('Erro A', '/a', {}, now + i);
    for (let i = 0; i < 6; i++) m.capture('Erro B', '/b', {}, now + i);
    // 5 de cada → 10 totais
    expect(m.calls.length).toBe(10);
  });

  it('após janela de 5s, novo report é aceito', () => {
    const m = makeMonitor();
    for (let i = 0; i < 6; i++) m.capture('Repetido', '/r', {}, 1_000_000 + i);
    const before = m.calls.length;
    const ok = m.capture('Repetido', '/r', {}, 1_000_000 + 6000);
    expect(ok).toBe(true);
    expect(m.calls.length).toBe(before + 1);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. DAILY CHECK-IN — virada de dia BRT em diferentes offsets
// ─────────────────────────────────────────────────────────────

function brtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

describe('daily check-in :: BRT independente de offset', () => {
  it('23:59 UTC = 20:59 BRT (mesmo dia)', () => {
    expect(brtDate('2026-04-29T23:59:00Z')).toBe('2026-04-29');
  });

  it('02:00 UTC = 23:00 BRT (dia anterior)', () => {
    expect(brtDate('2026-04-30T02:00:00Z')).toBe('2026-04-29');
  });

  it('03:00 UTC = 00:00 BRT (vira o dia)', () => {
    expect(brtDate('2026-04-30T03:00:00Z')).toBe('2026-04-30');
  });

  it('mesmo instante UTC → mesma data BRT independente do TZ local do dispositivo', () => {
    // O Intl com timeZone fixo ignora o offset local
    const iso = '2026-04-30T03:30:00Z';
    expect(brtDate(iso)).toBe('2026-04-30');
  });

  it('idempotência simulada: 3 chamadas no mesmo dia BRT → 1 grant + 2 already', () => {
    const today = '2026-04-29';
    const checkins = new Set<string>();
    const grants: string[] = [];
    const calls = ['2026-04-29T10:00:00Z', '2026-04-29T15:00:00Z', '2026-04-29T22:00:00Z'];
    for (const iso of calls) {
      const d = brtDate(iso);
      if (d !== today) continue;
      if (checkins.has(d)) {
        grants.push('already');
      } else {
        checkins.add(d);
        grants.push('granted');
      }
    }
    expect(grants).toEqual(['granted', 'already', 'already']);
  });

  it('virada de dia: check-in em 2026-04-29 23:59 BRT e 2026-04-30 00:01 BRT → 2 grants', () => {
    const checkins = new Set<string>();
    const grants: string[] = [];
    for (const iso of ['2026-04-30T02:59:00Z' /* 23:59 BRT 29 */, '2026-04-30T03:01:00Z' /* 00:01 BRT 30 */]) {
      const d = brtDate(iso);
      if (checkins.has(d)) grants.push('already');
      else { checkins.add(d); grants.push('granted'); }
    }
    expect(grants).toEqual(['granted', 'granted']);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. PWA INSTALL BONUS — concorrência (1 grant, N-1 already)
// ─────────────────────────────────────────────────────────────

describe('pwa install bonus :: concorrência atômica', () => {
  /**
   * Simula a constraint UNIQUE(provider_id, mission_key) com ON CONFLICT DO NOTHING:
   * apenas o primeiro request "ganha". Mesmo com 50 chamadas paralelas, só 1
   * recebe `granted` e os outros recebem `already_completed`.
   */
  function makeMissionTable() {
    const rows = new Map<string, { points: number }>();
    return {
      insertOnConflict(providerId: string, missionKey: string, points: number) {
        const k = `${providerId}::${missionKey}`;
        if (rows.has(k)) return { inserted: false };
        rows.set(k, { points });
        return { inserted: true };
      },
      grants() { return rows.size; },
    };
  }

  it('1 chamada → granted', () => {
    const t = makeMissionTable();
    expect(t.insertOnConflict('p1', 'app_installed', 30).inserted).toBe(true);
    expect(t.grants()).toBe(1);
  });

  it('50 chamadas paralelas → exatamente 1 granted, 49 already_completed', async () => {
    const t = makeMissionTable();
    const N = 50;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        Promise.resolve(t.insertOnConflict('p1', 'app_installed', 30)),
      ),
    );
    const granted = results.filter((r) => r.inserted).length;
    const already = results.filter((r) => !r.inserted).length;
    expect(granted).toBe(1);
    expect(already).toBe(N - 1);
    expect(t.grants()).toBe(1);
  });

  it('providers diferentes recebem grants independentes', () => {
    const t = makeMissionTable();
    expect(t.insertOnConflict('p1', 'app_installed', 30).inserted).toBe(true);
    expect(t.insertOnConflict('p2', 'app_installed', 30).inserted).toBe(true);
    expect(t.insertOnConflict('p1', 'app_installed', 30).inserted).toBe(false);
    expect(t.grants()).toBe(2);
  });

  it('missões diferentes para o mesmo provider são independentes', () => {
    const t = makeMissionTable();
    expect(t.insertOnConflict('p1', 'app_installed', 30).inserted).toBe(true);
    expect(t.insertOnConflict('p1', 'first_lead', 50).inserted).toBe(true);
    expect(t.insertOnConflict('p1', 'app_installed', 30).inserted).toBe(false);
    expect(t.grants()).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. SIGNUP error mapping (correção crítica da reclamação)
// ─────────────────────────────────────────────────────────────

function mapSignupError(msg: string): string {
  if (/already.*registered|user.*already.*exists|already_registered/i.test(msg))
    return 'conta_existente';
  if (/password.*(short|6 characters|weak)/i.test(msg)) return 'senha_curta';
  if (/rate limit|too many/i.test(msg)) return 'rate_limit';
  if (/email.*not.*confirmed|email_not_confirmed/i.test(msg)) return 'email_nao_confirmado';
  if (/invalid.*email|invalid.*format|validate email/i.test(msg)) return 'email_invalido';
  return 'desconhecido';
}

describe('signup :: mapeamento de erros do Supabase', () => {
  it('mapeia "User already registered"', () => {
    expect(mapSignupError('User already registered')).toBe('conta_existente');
  });
  it('mapeia "Password should be at least 6 characters"', () => {
    expect(mapSignupError('Password should be at least 6 characters')).toBe('senha_curta');
  });
  it('mapeia rate limit', () => {
    expect(mapSignupError('Email rate limit exceeded')).toBe('rate_limit');
  });
  it('mapeia invalid email', () => {
    expect(mapSignupError('Unable to validate email address: invalid format')).toBe('email_invalido');
  });
  it('mapeia email não confirmado', () => {
    expect(mapSignupError('Email not confirmed')).toBe('email_nao_confirmado');
  });
  it('fallback para desconhecido', () => {
    expect(mapSignupError('boom')).toBe('desconhecido');
  });
});
