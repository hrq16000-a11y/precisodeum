import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('provider slug resolution hardening', () => {
  const providerProfileSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProviderProfile.tsx'),
    'utf-8'
  );

  it('resolves aliases from provider_slug_aliases before giving not found', () => {
    expect(providerProfileSource).toContain("from('provider_slug_aliases' as any)");
  });

  it('uses canonical provider slug for SEO output', () => {
    expect(providerProfileSource).toContain('canonical: provider?.slug ?');
    expect(providerProfileSource).toContain('url: provider?.slug ?');
  });
});
