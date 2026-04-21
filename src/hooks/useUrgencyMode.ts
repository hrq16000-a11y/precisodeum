import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'urgency_mode_active';

/**
 * Shared persistent state for "Preciso para hoje" toggle (Hero ↔ SearchPage).
 * Survives navigation between Home and Search.
 */
export function useUrgencyMode() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Sync across tabs / re-mounts within session
  useEffect(() => {
    const handler = () => {
      try {
        setEnabledState(sessionStorage.getItem(STORAGE_KEY) === '1');
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', handler);
    window.addEventListener('urgency-mode-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('urgency-mode-change', handler);
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
    setEnabledState(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('urgency-mode-change'));
    }
  }, []);

  return { enabled, setEnabled };
}
