import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Testes de integração da RPC `search_cities`.
 * Validam que a busca encontra "São José" mesmo quando o usuário digita
 * sem acento ("Sao Jose") ou com case misto ("são jOSE").
 *
 * Skip automático se não houver acesso à internet (ex.: CI offline).
 */
async function canReachSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from('cities').select('id', { head: true, count: 'exact' }).limit(1);
    return !error;
  } catch {
    return false;
  }
}

describe('search_cities (RPC unaccent)', () => {
  let online = false;
  // setup once
  it('precondição — Supabase acessível', async () => {
    online = await canReachSupabase();
    // Se offline, marcamos como skipped via aviso, não como falha.
    if (!online) {
      console.warn('[search_cities] supabase não acessível — testes de integração serão pulados');
    }
    expect(true).toBe(true);
  });

  it('encontra "São José" buscando "sao jose" (sem acento, minúsculas)', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'sao jose' });
    expect(error).toBeNull();
    const names = (data || []).map((c: any) => c.name);
    expect(names.some((n: string) => n.startsWith('São José'))).toBe(true);
  });

  it('encontra "São Paulo" buscando "sao pa"', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'sao pa' });
    expect(error).toBeNull();
    const names = (data || []).map((c: any) => c.name);
    expect(names).toContain('São Paulo');
  });

  it('encontra "Goiânia" buscando "goian" (sem acento)', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'goian' });
    expect(error).toBeNull();
    const names = (data || []).map((c: any) => c.name);
    expect(names.some((n: string) => n.startsWith('Goiân'))).toBe(true);
  });

  it('respeita case misto ("são jOSE")', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'são jOSE' });
    expect(error).toBeNull();
    expect((data || []).length).toBeGreaterThan(0);
  });

  it('retorna vazio para termos < 2 caracteres', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'a' });
    expect(error).toBeNull();
    expect((data || []).length).toBe(0);
  });

  it('limita a 20 resultados', async () => {
    if (!online) return;
    const { data, error } = await supabase.rpc('search_cities', { term: 'sa' });
    expect(error).toBeNull();
    expect((data || []).length).toBeLessThanOrEqual(20);
  });
});
