/**
 * CompanyAddressForm — Formulário ISOLADO de endereço/identidade PJ.
 *
 * Objetivo: oferecer um único componente reutilizável para coletar dados
 * institucionais opcionais (endereço físico + identidade) de prestadores PJ.
 *
 * REGRAS DE SEGURANÇA:
 *  - NÃO é usado por RH/Agências (DashboardAgencyDataPage tem seu próprio fluxo).
 *  - NÃO substitui formulários existentes; é aditivo (opt-in).
 *  - É totalmente controlado (controlled component) — não persiste sozinho.
 *  - Todos os campos são OPCIONAIS. Strings vazias são aceitas.
 *
 * Consumidores típicos:
 *  - DashboardCompanyDataPage (gestão pós-cadastro)
 *  - Futuros wizards PJ (sob feature flag)
 */
import { MapPin, Store, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CompanyAddressValue {
  street?: string;
  street_number?: string;
  complement?: string;
  postal_code?: string;
  show_full_address?: boolean;
}

interface Props {
  value: CompanyAddressValue;
  onChange: (patch: Partial<CompanyAddressValue>) => void;
  /** Cidade/bairro do prestador (apenas para preview do toggle de privacidade). */
  cityPreview?: { city?: string; neighborhood?: string };
  /** Quando true, inicia colapsado com botão "Adicionar endereço". */
  collapsible?: boolean;
  /** Texto do botão de revelação (collapsible mode). */
  revealLabel?: string;
}

export default function CompanyAddressForm({
  value,
  onChange,
  cityPreview,
  collapsible = false,
  revealLabel = 'Adicionar endereço do ponto de atendimento físico',
}: Props) {
  const hasContent = Boolean(
    value.street || value.street_number || value.postal_code || value.complement,
  );
  const [open, setOpen] = useState(!collapsible || hasContent);

  const fields = (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3" /> Logradouro
          </span>
          <input
            type="text"
            value={value.street ?? ''}
            onChange={(e) => onChange({ street: e.target.value })}
            placeholder="Rua / Avenida"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Número
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value.street_number ?? ''}
            onChange={(e) => onChange({ street_number: e.target.value })}
            placeholder="123"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Complemento
          </span>
          <input
            type="text"
            value={value.complement ?? ''}
            onChange={(e) => onChange({ complement: e.target.value })}
            placeholder="Sala / Bloco (opcional)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            CEP
          </span>
          <input
            type="tel"
            inputMode="numeric"
            value={value.postal_code ?? ''}
            onChange={(e) =>
              onChange({ postal_code: e.target.value.replace(/\D/g, '').slice(0, 8) })
            }
            placeholder="00000-000"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-lg bg-background/60 p-2 text-[11px] leading-snug text-foreground">
        <input
          type="checkbox"
          checked={Boolean(value.show_full_address)}
          onChange={(e) => onChange({ show_full_address: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span>
          <span className="font-semibold">Exibir endereço completo no perfil público.</span>{' '}
          <span className="text-muted-foreground">
            Se desativado, mostramos apenas “Ponto de atendimento físico em{' '}
            {cityPreview?.neighborhood || 'seu bairro'}, {cityPreview?.city || 'sua cidade'}”.
          </span>
        </span>
      </label>
    </div>
  );

  if (!collapsible) return fields;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left text-[12px] leading-snug text-foreground transition hover:text-accent"
      >
        <Store className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="flex-1">
          <span className="font-semibold">{revealLabel}</span>{' '}
          <span className="text-muted-foreground">(oficina, salão, loja). Opcional.</span>
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="addr"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden pt-1"
          >
            {fields}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
