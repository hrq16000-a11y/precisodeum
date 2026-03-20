import DashboardLayout from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardCommunityPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['community-links'],
    queryFn: async () => {
      const { data } = await supabase
        .from('community_links' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Comunidade dos Prestadores</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recursos, materiais e links úteis para profissionais</p>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando...</p>
      ) : links.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Nenhum recurso disponível no momento.</p>
          <p className="mt-1 text-xs text-muted-foreground">O administrador ainda não cadastrou conteúdos para a comunidade.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(links as any[]).map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
            >
              <span className="text-2xl">{link.icon || '🔗'}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
                {link.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{link.description}</p>}
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default DashboardCommunityPage;
