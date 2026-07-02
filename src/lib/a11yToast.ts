/**
 * a11yToast — wrapper sobre `sonner` que ALÉM de mostrar o toast,
 * anuncia a mensagem em uma região `role="alert" aria-live="assertive"`
 * para que leitores de tela interrompam a leitura corrente.
 *
 * sonner por padrão usa `role="status" aria-live="polite"` em todos os
 * toasts, o que pode passar despercebido em ações concorrentes (uploads,
 * navegação). Para erros críticos (timeout de Edge Function, falha de
 * rede em ações administrativas) queremos `assertive`.
 */
import { toast } from 'sonner';

const REGION_ID = '__lov_a11y_alert_region__';

function ensureRegion(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  let node = document.getElementById(REGION_ID) as HTMLDivElement | null;
  if (!node) {
    node = document.createElement('div');
    node.id = REGION_ID;
    node.setAttribute('role', 'alert');
    node.setAttribute('aria-live', 'assertive');
    node.setAttribute('aria-atomic', 'true');
    // visualmente oculto, mas lido por SR
    node.style.position = 'absolute';
    node.style.width = '1px';
    node.style.height = '1px';
    node.style.padding = '0';
    node.style.margin = '-1px';
    node.style.overflow = 'hidden';
    node.style.clip = 'rect(0,0,0,0)';
    node.style.whiteSpace = 'nowrap';
    node.style.border = '0';
    document.body.appendChild(node);
  }
  return node;
}

function announce(message: string) {
  const node = ensureRegion();
  if (!node) return;
  // Truque: limpar e setar de novo força o SR a re-anunciar.
  node.textContent = '';
  // microtask para garantir que a mudança seja detectada
  setTimeout(() => { if (node) node.textContent = message; }, 30);
}

/** Toast de erro com anúncio assertivo para leitores de tela. */
export function toastAssertiveError(message: string, opts?: Parameters<typeof toast.error>[1]) {
  announce(message);
  return toast.error(message, opts);
}

/** Toast de aviso com anúncio assertivo (use só para alertas que exigem reação imediata). */
export function toastAssertiveWarning(message: string, opts?: Parameters<typeof toast.warning>[1]) {
  announce(message);
  return toast.warning(message, opts);
}
