/** Phase Pro Document — CPF (PF) ou CNPJ + Nome Fantasia (PJ), troca por selo + pontos. */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isValidCpf, isValidCnpj } from '@/lib/cpfCnpj';
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
  // Convite opcional ao "ponto de atendimento físico" (PJ apenas).
  const [showAddress, setShowAddress] = useState(
    !isPf && Boolean(state.street || state.street_number || state.postal_code),
  );

  const docDigits = useMemo(() => state.document.replace(/\D/g, ''), [state.document]);
  const docValid = isPf ? isValidCpf(docDigits) : isValidCnpj(docDigits);
  const companyOk = isPf ? true : state.company_name.trim().length >= 2;
  const sealEarned = docValid && companyOk;
  const canAdvance = true;

  // CEP lookup, sugestão, retry e validação inline ficam dentro do CompanyAddressForm.

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
                  : 'border-input focus:border-indigo-400 focus:ring-indigo-300/40'
              }`}
            />
          </label>
        )}

        {!isPf && (
          <CompanyAddressForm
            collapsible
            revealLabel="Possui ponto de atendimento físico (loja, oficina, salão)?"
            cityPreview={{ city: state.city, neighborhood: state.neighborhood }}
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
        className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
      >
        {sealEarned ? 'Resgatar selo e continuar' : 'Continuar (posso preencher depois)'}
        <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
