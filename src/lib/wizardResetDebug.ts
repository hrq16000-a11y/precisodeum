export type WizardDebugEntry = {
  at: string;
  source: string;
  route: string;
  phase?: string | null;
  nextRoute?: string | null;
  reason: string;
  meta?: Record<string, unknown>;
};

const KEY = 'wizard_reset_debug_v1';
const MAX = 120;

function readRaw(): WizardDebugEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readWizardResetDebugLog(): WizardDebugEntry[] {
  return readRaw();
}

export function clearWizardResetDebugLog() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function appendWizardResetDebugLog(entry: Omit<WizardDebugEntry, 'at'>) {
  if (typeof window === 'undefined') return;
  try {
    const current = readRaw();
    const next: WizardDebugEntry[] = [
      {
        at: new Date().toISOString(),
        ...entry,
      },
      ...current,
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}
