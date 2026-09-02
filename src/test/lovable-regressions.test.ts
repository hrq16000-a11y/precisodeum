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
  it('registers onboarding realtime handlers only through the shared channel registry', () => {
    const source = fs.readFileSync('src/hooks/useOnboardingStatus.ts', 'utf8');
    expect(source).toContain('acquireChannel(channelName');
    expect(source).toContain('releaseChannel(channelName)');
    expect(source).not.toContain(".channel(`onb-status-");
  });
  it('uses one route owner for both programmatic and popular service landings', () => {
    const layout = fs.readFileSync('src/routes/servico/$serviceSlug.tsx', 'utf8');
    const index = fs.readFileSync('src/routes/servico/$serviceSlug.index.tsx', 'utf8');
    expect(layout).not.toContain('throw notFound()');
    expect(index).toContain('<PopularServicePage />');
    expect(fs.existsSync('src/routes/servico/$slug.tsx')).toBe(false);
  });
  it('keeps critical auth alerting and delayed realtime setup guarded', () => {
    const notifier = fs.readFileSync('supabase/functions/notify-auth-errors/index.ts', 'utf8');
    const verification = fs.readFileSync('src/components/profile/VerificationStatusBadge.tsx', 'utf8');
    expect(notifier).toContain('const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(verification).toContain('if (alive && prov?.id)');
  });
});
