// Phase 2.5 — Sponsor Billing helpers (read-only logic shared by sponsor + admin UI)

export type BillingHealth =
  | 'healthy'
  | 'expiring_soon'
  | 'awaiting_payment'
  | 'grace'
  | 'expired';

export type BillingCycleStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'overdue'
  | 'grace'
  | 'cancelled'
  | 'expired';

export interface BillingCycleRow {
  id: string;
  sponsor_id: string;
  cycle_start: string;
  cycle_end: string;
  amount: number | null;
  status: BillingCycleStatus;
  payment_method: string | null;
  invoice_reference: string | null;
  renewal_requested: boolean;
  renewal_requested_at?: string | null;
  auto_renew?: boolean;
  grace_until: string | null;
  paid_at: string | null;
  admin_note: string | null;
  created_at?: string;
  updated_at?: string;
  subscription_id?: string | null;
}

export interface BillingStatusPayload {
  sponsor_id: string;
  health: BillingHealth;
  days_left: number | null;
  current_cycle: BillingCycleRow | null;
  subscription: {
    id: string;
    status: string;
    current_period_end: string | null;
    amount_paid: number | null;
    billing_cycle: string;
  } | null;
  history: BillingCycleRow[];
}

export const HEALTH_LABEL: Record<BillingHealth, string> = {
  healthy: 'Saudável',
  expiring_soon: 'Vence em breve',
  awaiting_payment: 'Aguardando pagamento',
  grace: 'Em tolerância',
  expired: 'Expirado',
};

export const HEALTH_VARIANT: Record<BillingHealth, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  healthy: 'secondary',
  expiring_soon: 'outline',
  awaiting_payment: 'outline',
  grace: 'default',
  expired: 'destructive',
};

export const STATUS_LABEL: Record<BillingCycleStatus, string> = {
  pending: 'Pendente',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  overdue: 'Em atraso',
  grace: 'Em tolerância',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

export function computeDaysLeft(cycleEnd: string | null | undefined): number | null {
  if (!cycleEnd) return null;
  const ms = new Date(cycleEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Calcula a saúde de forma idêntica ao SQL `get_sponsor_billing_status`.
 * Usado em testes e como fallback de UI quando o RPC ainda não respondeu.
 */
export function computeHealth(cycle: Pick<BillingCycleRow, 'status' | 'cycle_end' | 'grace_until'> | null): BillingHealth {
  if (!cycle) return 'healthy';
  const now = Date.now();
  const end = new Date(cycle.cycle_end).getTime();
  if (cycle.status === 'expired' || cycle.status === 'cancelled') return 'expired';
  if (cycle.status === 'grace') return 'grace';
  if (cycle.status === 'overdue' || cycle.status === 'awaiting_payment') return 'awaiting_payment';
  if (cycle.status === 'paid' && end > now && end <= now + 7 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  if (end <= now) return 'expired';
  if (end <= now + 7 * 24 * 60 * 60 * 1000) return 'expiring_soon';
  return 'healthy';
}
