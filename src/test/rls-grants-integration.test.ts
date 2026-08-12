/**
 * Testes de integração RLS/GRANTs (executam só quando as env vars do backend
 * estão disponíveis; caso contrário são pulados para não quebrar CI offline).
 *
 * Contrato validado como visitante anônimo:
 *  - jobs: colunas de contato (contact_phone/whatsapp/contact_name) NÃO legíveis
 *  - jobs: colunas públicas (id/title) legíveis
 *  - sponsors: cnpj/email NÃO legíveis
 *  - profiles: leitura direta bloqueada; public_profiles acessível
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const RUN = !!SUPABASE_URL && !!SUPABASE_KEY;
const maybe = RUN ? describe : describe.skip;

const anonClient = () =>
  createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

maybe('RLS/GRANTs · visitante anônimo', () => {
  it('não lê colunas de contato em jobs', async () => {
    const client = anonClient();
    for (const col of ['contact_phone', 'whatsapp', 'contact_name']) {
      const { data, error } = await client.from('jobs' as never).select(`id, ${col}`).limit(1);
      expect(error, `coluna ${col} deveria ser negada para anon`).toBeTruthy();
      expect(data ?? null).toBeNull();
    }
  });

  it('lê colunas públicas de jobs normalmente', async () => {
    const client = anonClient();
    const { error } = await client.from('jobs' as never).select('id, title, city, slug').limit(1);
    expect(error).toBeNull();
  });

  it('não lê cnpj/email de sponsors', async () => {
    const client = anonClient();
    const { data, error } = await client.from('sponsors' as never).select('id, cnpj, email').limit(1);
    expect(error).toBeTruthy();
    expect(data ?? null).toBeNull();
  });

  it('não lê a tabela profiles diretamente, mas acessa public_profiles', async () => {
    const client = anonClient();
    const direct = await client.from('profiles' as never).select('id, email').limit(1);
    expect(direct.error, 'profiles não deveria ser legível por anon').toBeTruthy();

    const view = await client.from('public_profiles' as never).select('id').limit(1);
    expect(view.error).toBeNull();
  });
});

if (!RUN) {
  // eslint-disable-next-line no-console
  console.warn('[rls-grants-integration] Skipped: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes.');
}
