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
        // Delega ao RPC SECURITY DEFINER `check_tax_id_duplicate`, que combina
        // tax_id_last4 + tax_id_kind e, quando possível, confirma via tax_id
        // exato — sem expor o documento bruto ao cliente.
        const { data, error } = await supabase.rpc('check_tax_id_duplicate', {
          _digits: clean,
          _ignore_user_id: ignoreUserId ?? null,
        });
        if (error) {
          setDuplicates((d) => ({ ...d, tax_id: false }));
          return false;
        }
        const dup = Boolean(data);
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
