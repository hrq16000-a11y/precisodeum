/** Phase Pro Document — CPF (PF) ou CNPJ + Nome Fantasia (PJ), troca por selo + pontos. */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isValidCpf, isValidCnpj } from '@/lib/cpfCnpj';
import { useGeoCity } from '@/hooks/useGeoCity';
import { lookupCep } from '@/lib/cepLookup';
import VerifiedBadgeReveal from './VerifiedBadgeReveal';
import { BET_POINTS, type BetState } from './types';
import CompanyAddressForm, { type CompanyAddressValue } from '@/components/company/CompanyAddressForm';

interface Props {
  state: BetState;
  patch: (p: Partial<BetState>) => void;
  next: () => void;
  addPoints: (n: number) => void;
}

function formatCpf(d: string) {
  const x = d.replace(/\D/g, '').slice(0, 11);
  return x
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}
function formatCnpj(d: string) {
  const x = d.replace(/\D/g, '').slice(0, 14);
  return x
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function PhaseProDocument({ state, patch, next, addPoints }: Props) {
  const isPf = state.pro_kind === 'pf';
  const [showBadge, setShowBadge] = useState(false);
  const [awarded, setAwarded] = useState(false);
  const [autoFillStatus, setAutoFillStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [autoFillError, setAutoFillError] = useState<string | undefined>(undefined);
  const { requestPreciseLocation } = useGeoCity();

  const docDigits = useMemo(() => state.document.replace(/\D/g, ''), [state.document]);
  const docValid = isPf ? isValidCpf(docDigits) : isValidCnpj(docDigits);
  const companyOk = isPf ? true : state.company_name.trim().length >= 2;
  const sealEarned = docValid && companyOk;

  // Auto-preenchimento via GPS: pega coordenadas → reverse geocode (Nominatim)
  // → CEP → lookupCep para obter logradouro/cidade/UF/bairro completos.
  const handleAutoFill = useCallback(async () => {
    setAutoFillStatus('loading');
    setAutoFillError(undefined);
    try {
      const r = await requestPreciseLocation({ force: true });
      const lat = r.latitude;
      const lon = r.longitude;
      if (!r.ok || lat == null || lon == null) {
        setAutoFillStatus('error');
        setAutoFillError('Permissão de localização negada. Você pode preencher manualmente.');
        return;
      }
      // Tenta extrair CEP do Nominatim — mais confiável p/ logradouro no BR.
      let postcode: string | null = null;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&accept-language=pt-BR&zoom=18&addressdetails=1`,
          { headers: { Accept: 'application/json' } },
        );
        if (resp.ok) {
          const data = await resp.json();
          const raw = (data?.address?.postcode || '').toString().replace(/\D/g, '');
          if (raw.length === 8) postcode = raw;
        }
      } catch { /* ignora */ }

      if (postcode) {
        // Aplica CEP e dispara o lookup automático do CompanyAddressForm.
        const cepResult = await lookupCep(postcode);
        if (cepResult.ok) {
          patch({
            postal_code: postcode,
            street: cepResult.address || state.street,
            street_suggested: cepResult.address || '',
            street_suggested_cep: postcode,
            street_confirmed: false,
            bairro_sugerido_cep: cepResult.neighborhood || state.bairro_sugerido_cep,
          });
          setAutoFillStatus('success');
          return;
        }
        // CEP não encontrado nas bases — preenche só o CEP e deixa usuário completar.
        patch({ postal_code: postcode });
        setAutoFillStatus('success');
        return;
      }

      // Sem CEP: aplica ao menos cidade/bairro vindos do GPS.
      if (r.city || r.neighborhood) {
        setAutoFillStatus('success');
        return;
      }
      setAutoFillStatus('error');
      setAutoFillError('Não foi possível identificar seu CEP — preencha manualmente.');
    } catch (err) {
      setAutoFillStatus('error');
      setAutoFillError('Falha ao consultar GPS. Tente novamente ou preencha manualmente.');
    }
  }, [requestPreciseLocation, patch, state.street, state.bairro_sugerido_cep]);


  useEffect(() => {
    if (sealEarned && !awarded) {
      setAwarded(true);
      addPoints(isPf ? BET_POINTS.cpf_badge : BET_POINTS.cnpj_badge);
      setShowBadge(true);
    }
  }, [sealEarned, awarded, addPoints, isPf]);

  function handleDoc(v: string) {
    const digits = v.replace(/\D/g, '');
    patch({ document: digits });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
    >
      <header className="space-y-2 text-center">
        <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
          {isPf ? 'Confirme seu CPF' : 'Confirme seu CNPJ'}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isPf ? `Troca direta: CPF → Selo de Confiança + ${BET_POINTS.cpf_badge} pts.` : `Troca direta: CNPJ + Nome Fantasia → Selo Empresa Verificada + ${BET_POINTS.cnpj_badge} pts.`}
        </p>
      </header>

      {showBadge && (
        <VerifiedBadgeReveal
          variant={isPf ? 'pf' : 'pj'}
          label={isPf ? 'Selo de Confiança' : 'Empresa Verificada'}
          onDone={() => {/* selo fixa */}}
        />
      )}

      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> {isPf ? 'CPF' : 'CNPJ'}
          </span>
          <input
            type="tel"
            inputMode="numeric"
            value={isPf ? formatCpf(state.document) : formatCnpj(state.document)}
            onChange={(e) => handleDoc(e.target.value)}
            placeholder={isPf ? '000.000.000-00' : '00.000.000/0000-00'}
            className={`w-full rounded-lg border bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:ring-2 ${
              docValid
                ? 'border-emerald-500 ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] focus:border-emerald-500 focus:ring-emerald-300/50'
                : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
            }`}
          />
        </label>

        {!isPf && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Nome Fantasia
            </span>
            <input
              type="text"
              value={state.company_name}
              onChange={(e) => patch({ company_name: e.target.value })}
              placeholder="Como a empresa é conhecida"
              className={`w-full rounded-lg border bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:ring-2 ${
                state.company_name.trim().length >= 2
                  ? 'border-emerald-500 ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] focus:border-emerald-500 focus:ring-emerald-300/50'
                  : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
              }`}
            />
          </label>
        )}

        {!isPf && (
          // PJ: bloco "Adicionar endereço" — Opcional. Permanece colapsado até
          // o usuário clicar no revelador. Não impõe required em nenhum campo
          // (validado pelo teste wizard-pj-optional-address).
          <CompanyAddressForm
            collapsible
            revealLabel="Possui ponto de atendimento físico (loja, oficina, salão)? Adicionar endereço (Opcional)"
            cityPreview={{ city: state.city, neighborhood: state.neighborhood }}
            onAutoFill={handleAutoFill}
            autoFillStatus={autoFillStatus}
            autoFillError={autoFillError}
            value={{
              street: state.street,
              street_number: state.street_number,
              complement: state.complement,
              postal_code: state.postal_code,
              show_full_address: state.show_full_address,
              street_suggested: state.street_suggested,
              street_suggested_cep: state.street_suggested_cep,
              street_confirmed: state.street_confirmed,
              cep_history: state.cep_history,
            }}
            onChange={(p: Partial<CompanyAddressValue>) => patch(p as Partial<BetState>)}
          />
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {sealEarned
            ? `Selo conquistado · +${isPf ? BET_POINTS.cpf_badge : BET_POINTS.cnpj_badge} pts`
            : `Preenchimento opcional. Quem confirma ganha o ${isPf ? 'Selo de Confiança' : 'Selo Empresa Verificada'} e até +${isPf ? BET_POINTS.cpf_badge : BET_POINTS.cnpj_badge} pts.`}
        </p>
      </div>

      <Button
        size="lg"
        onClick={next}
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
      >
        {sealEarned ? 'Resgatar selo e continuar' : 'Continuar (posso preencher depois)'}
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
