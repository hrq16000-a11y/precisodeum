import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Props { userId?: string }

const RhPublicPageLink = ({ userId }: Props) => {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('agencies')
        .select('slug, status')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.slug && data.status === 'approved') setSlug(data.slug);
    })();
  }, [userId]);

  if (!slug) return null;

  return (
    <div className="mt-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-bold text-foreground">Sua página pública está no ar</p>
        <p className="text-xs text-muted-foreground font-mono">/agencia/{slug}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={() => window.open(`/agencia/${slug}`, '_blank', 'noopener')}
      >
        <ExternalLink className="h-4 w-4" />
        Ver minha página pública
      </Button>
    </div>
  );
};

export default RhPublicPageLink;
