import { memo, useEffect, useState } from 'react';
import { TrendingUp, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const UrgencyBanner = memo(() => {
  const [visible, setVisible] = useState(false);

  const { data: recentCount = 0 } = useQuery({
    queryKey: ['urgency-recent-leads'],
    queryFn: async () => {
      const since = new Date();
      since.setHours(since.getHours() - 24);
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString());
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  if (recentCount === 0) return null;

  return (
    <div
      className={`bg-gradient-to-r from-accent/10 via-accent/5 to-accent/10 border-y border-accent/20 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 animate-pulse">
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <div className="text-sm">
            <span className="font-bold text-foreground">{recentCount} solicitações</span>
            <span className="text-muted-foreground"> nas últimas 24h</span>
          </div>
          <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Clock className="h-3 w-3" />
            Profissionais respondendo agora
          </div>
        </div>
        <Button variant="accent" size="sm" className="rounded-full text-xs shadow-sm" asChild>
          <Link to="/cadastro">Cadastre-se grátis</Link>
        </Button>
      </div>
    </div>
  );
});

UrgencyBanner.displayName = 'UrgencyBanner';

export default UrgencyBanner;
