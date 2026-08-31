import fs from 'fs';
import { describe, expect, it } from 'vitest';

describe('Lovable regressions', () => {
  it('does not read window while ResetPasswordPage is rendered on the server', () => {
    const source = fs.readFileSync('src/pages/ResetPasswordPage.tsx', 'utf8');
    expect(source).toContain("typeof window === 'undefined'");
  });
  it('uses the public sponsor projection and accent-insensitive neighborhood matching', () => {
    expect(fs.readFileSync('src/hooks/useSponsors.ts', 'utf8')).toContain("sponsors_public' as any");
    expect(fs.readFileSync('src/components/ads/AdSlot.tsx', 'utf8')).toContain("sponsors_public' as any");
    expect(fs.readFileSync('src/pages/SeoPage.tsx', 'utf8')).toContain('normalizeLocation');
  });
});
