import { supabase } from '@/integrations/supabase/client';

export type JobContact = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
};

/**
 * jobs.contact_name / contact_phone / whatsapp foram revogados no PostgREST
 * (até para `authenticated`). A leitura acontece só via RPC SECURITY DEFINER
 * `get_jobs_contacts`, que devolve apenas vagas do próprio usuário ou, se admin,
 * todas. Retorna um Map id → contato (vazio quando negado).
 */
export async function fetchJobContacts(jobIds?: string[]): Promise<Map<string, JobContact>> {
  const map = new Map<string, JobContact>();
  if (jobIds && jobIds.length === 0) return map;
  const { data, error } = await supabase.rpc('get_jobs_contacts', {
    _job_ids: jobIds ?? null,
  } as never);
  if (error || !Array.isArray(data)) return map;
  for (const row of data as JobContact[]) map.set(row.id, row);
  return map;
}

/** Mescla contatos no array de vagas (campos ausentes viram null). */
export async function mergeJobContacts<T extends { id: string }>(jobs: T[]): Promise<Array<T & JobContact>> {
  const contacts = await fetchJobContacts(jobs.map((j) => j.id));
  return jobs.map((j) => ({
    ...j,
    ...(contacts.get(j.id) ?? { id: j.id, contact_name: null, contact_phone: null, whatsapp: null }),
  }));
}
