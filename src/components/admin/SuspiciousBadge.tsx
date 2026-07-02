import { ShieldAlert } from 'lucide-react';

interface Props {
  reason?: string | null;
  ip?: string | null;
  size?: 'sm' | 'md';
}

/**
 * Badge pulsante exibido em perfis marcados como is_suspicious.
 * Usado em /admin/prestadores e /admin/usuarios.
 */
const SuspiciousBadge = ({ reason, ip, size = 'sm' }: Props) => {
  const title = reason || (ip ? `Múltiplos cadastros detectados no IP ${ip}` : 'Perfil sob suspeita');
  const cls = size === 'sm'
    ? 'px-1.5 py-0.5 text-[9px]'
    : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      title={title}
      className={`relative inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive font-bold uppercase tracking-wider ring-1 ring-destructive/40 ${cls}`}
    >
      <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" aria-hidden />
      <ShieldAlert className="h-3 w-3 relative" />
      <span className="relative">Sob Suspeita</span>
    </span>
  );
};

export default SuspiciousBadge;
