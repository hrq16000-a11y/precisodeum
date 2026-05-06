/**
 * Stability tests for PWA module
 *
 * BLINDADO: These tests guarantee the PWA module integrity.
 * All PWA files must import correctly and export expected symbols.
 * If any test fails, DO NOT deploy — fix the PWA module first.
 */
import { describe, it, expect } from 'vitest';

describe('PWA Module — Stability', () => {
  it('usePwaInstall exports all required symbols', async () => {
    const mod = await import('@/hooks/usePwaInstall');

    expect(mod.usePwaSettings).toBeDefined();
    expect(typeof mod.usePwaSettings).toBe('function');

    expect(mod.useIsStandalone).toBeDefined();
    expect(typeof mod.useIsStandalone).toBe('function');

    expect(mod.trackPwaEvent).toBeDefined();
    expect(typeof mod.trackPwaEvent).toBe('function');

    expect(mod.usePwaInstallPrompt).toBeDefined();
    expect(typeof mod.usePwaInstallPrompt).toBe('function');

    expect(mod.PWA_OPEN_INSTALL_MODAL_EVENT).toBe('pwa:open-install-modal');
  });

  it('PwaInstallBanner can be imported', async () => {
    const mod = await import('@/components/PwaInstallBanner');
    expect(mod.default).toBeDefined();
  });

  it('PwaInstallSection can be imported', async () => {
    const mod = await import('@/components/home/PwaInstallSection');
    expect(mod.default).toBeDefined();
  });

  it('PwaFooterInstall can be imported', async () => {
    const mod = await import('@/components/PwaFooterInstall');
    expect(mod.default).toBeDefined();
  });

  it('usePwaNotifications can be imported', async () => {
    const mod = await import('@/hooks/usePwaNotifications');
    expect(mod.usePwaNotifications).toBeDefined();
    expect(typeof mod.usePwaNotifications).toBe('function');
  });

  it('usePwaInstall has NO device-restriction logic', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/hooks/usePwaInstall.ts', 'utf-8');

    // Must NOT contain iOS detection
    expect(content).not.toContain('useIsIos');
    expect(content).not.toContain('iPad');
    expect(content).not.toContain('iPhone');

    // Must NOT contain restrictive messages
    expect(content).not.toContain('abra no celular');
    expect(content).not.toContain('abra no navegador');
    expect(content).not.toContain('use o menu');

    // Must contain the try/finally safety pattern
    expect(content).toContain('finally');
    expect(content).toContain('promptRef.current = null');
  });

  it('PwaInstallBanner has NO device-restriction logic', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/PwaInstallBanner.tsx', 'utf-8');

    expect(content).not.toContain('useIsIos');
    expect(content).not.toContain('isIos');
    expect(content).not.toContain('abra no celular');
    expect(content).not.toContain('abra no navegador');

    // Must close modal BEFORE async install
    expect(content).toContain('setShow(false)');
  });

  it('PwaInstallSection has NO device-restriction logic', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/home/PwaInstallSection.tsx', 'utf-8');

    expect(content).not.toContain('useIsIos');
    expect(content).not.toContain('isIos');
    expect(content).not.toContain('abra no celular');
  });

  it('PwaFooterInstall has NO device-restriction logic', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/PwaFooterInstall.tsx', 'utf-8');

    expect(content).not.toContain('useIsIos');
    expect(content).not.toContain('isIos');
    expect(content).not.toContain('abra no celular');
  });
});
