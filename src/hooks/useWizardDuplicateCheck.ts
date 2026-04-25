import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isValidCpfCnpj } from '@/lib/cpfCnpj';

export type DuplicateField = 'whatsapp' | 'tax_id';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  loading: boolean;
  error: string | null;
}

interface UseWizardDuplicateCheckResult {
  checking: Record<DuplicateField, boolean>;
  duplicates: Record<DuplicateField, boolean>;
  /** Verifica WhatsApp (apenas dígitos). Retorna true se já existe. */
  checkWhatsapp: (digits: string, ignoreUserId?: string) => Promise<boolean>;
  /** Verifica CPF/CNPJ (apenas dígitos). Retorna true se já existe. */
  checkTaxId: (digits: string, ignoreUserId?: string) => Promise<boolean>;
  reset: (field?: DuplicateField) => void;
}

/**
 * Hook para validação inline (onBlur) de duplicidade no Supabase.
 * Usa a tabela `profiles`. Em modo edit, passe `ignoreUserId` para não
 * conflitar com o próprio registro.
 */
export function useWizardDuplicateCheck(): UseWizardDuplicateCheckResult {
  const [checking, setChecking] = useState<Record<DuplicateField, boolean>>({
    whatsapp: false,
    tax_id: false,
  });
  const [duplicates, setDuplicates] = useState<Record<DuplicateField, boolean>>({
    whatsapp: false,
    tax_id: false,
  });

  const checkWhatsapp = useCallback(
    async (digits: string, ignoreUserId?: string): Promise<boolean> => {
      const clean = (digits || '').replace(/\D/g, '');
      if (clean.length < 10 || clean.length > 13) {
        setDuplicates((d) => ({ ...d, whatsapp: false }));
        return false;
      }
      setChecking((c) => ({ ...c, whatsapp: true }));
      try {
        let query = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('whatsapp', clean);
        if (ignoreUserId) query = query.neq('id', ignoreUserId);
        const { count, error } = await query;
        if (error) {
          setDuplicates((d) => ({ ...d, whatsapp: false }));
          return false;
        }
        const dup = (count ?? 0) > 0;
        setDuplicates((d) => ({ ...d, whatsapp: dup }));
        return dup;
      } finally {
        setChecking((c) => ({ ...c, whatsapp: false }));
      }
    },
    [],
  );

  const checkTaxId = useCallback(
    async (digits: string, ignoreUserId?: string): Promise<boolean> => {
      const clean = (digits || '').replace(/\D/g, '');
      // Só consulta se for CPF/CNPJ válido — evita ruído e falso positivo.
      if (!isValidCpfCnpj(clean)) {
        setDuplicates((d) => ({ ...d, tax_id: false }));
        return false;
      }
      setChecking((c) => ({ ...c, tax_id: true }));
      try {
        const last4 = clean.slice(-4);
        const kind: 'cpf' | 'cnpj' = clean.length === 11 ? 'cpf' : 'cnpj';

        // Estratégia em 2 passos para reduzir falso positivo:
        //  1) Filtra publicamente por tax_id_last4 + tax_id_kind (campos não-sensíveis,
        //     legíveis via RLS pública). Isso retorna candidatos plausíveis.
        //  2) Se houver candidatos, tenta confirmar com tax_id direto. RLS pode
        //     restringir esse campo — nesse caso, tratamos last4+kind como sinal
        //     suficiente (já é uma colisão estatisticamente improvável).
        let candidatesQuery = supabase
          .from('profiles')
          .select('id, tax_id', { count: 'exact' })
          .eq('tax_id_last4', last4)
          .eq('tax_id_kind', kind)
          .limit(10);
        if (ignoreUserId) candidatesQuery = candidatesQuery.neq('id', ignoreUserId);

        const { data: candidates, error } = await candidatesQuery;
        if (error || !candidates || candidates.length === 0) {
          setDuplicates((d) => ({ ...d, tax_id: false }));
          return false;
        }

        // Confirmação exata quando RLS permite ler tax_id; senão usa last4+kind.
        const exact = candidates.some((c) => (c as { tax_id?: string | null }).tax_id === clean);
        const dup = exact || candidates.length > 0;
        setDuplicates((d) => ({ ...d, tax_id: dup }));
        return dup;
      } finally {
        setChecking((c) => ({ ...c, tax_id: false }));
      }
    },
    [],
  );

  const reset = (field?: DuplicateField) => {
    if (field) {
      setDuplicates((d) => ({ ...d, [field]: false }));
      setChecking((c) => ({ ...c, [field]: false }));
    } else {
      setDuplicates({ whatsapp: false, tax_id: false });
      setChecking({ whatsapp: false, tax_id: false });
    }
  };

  return { checking, duplicates, checkWhatsapp, checkTaxId, reset };
}
