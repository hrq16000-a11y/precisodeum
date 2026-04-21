import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Building2, MapPin, Mail, Phone, Globe, Briefcase } from 'lucide-react';
import { useSeoHead } from '@/hooks/useSeoHead';

const AgencyPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [agency, setAgency] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useSeoHead({
    title: agency ? `${agency.name} — Agência de RH` : 'Agência de RH',
    description: agency?.description || 'Perfil público da agência de recrutamento.',
  });

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('agencies')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'approved')
        .maybeSingle();
      setAgency(data);
      if (data?.user_id) {
        const { data: js } = await supabase
          .from('jobs')
          .select('id, title, city, state, slug, created_at')
          .eq('user_id', data.user_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20);
        setJobs(js || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !agency ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-xl font-bold text-foreground">Agência não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">Este perfil não está disponível ou está pendente de aprovação.</p>
          </div>
        ) : (
          <>
            <header className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-2xl font-bold text-foreground">{agency.name}</h1>
                  {agency.legal_name && <p className="text-xs text-muted-foreground mt-0.5">{agency.legal_name}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {(agency.city || agency.state) && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{agency.city}{agency.state ? ` • ${agency.state}` : ''}</span>
                    )}
                    {agency.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{agency.email}</span>}
                    {agency.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{agency.whatsapp}</span>}
                    {agency.website && <a href={agency.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="h-3.5 w-3.5" />Site</a>}
                  </div>
                </div>
              </div>
              {agency.description && <p className="mt-4 text-sm text-foreground/90 leading-relaxed">{agency.description}</p>}
            </header>

            <section className="mt-6">
              <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Vagas abertas ({jobs.length})
              </h2>
              {jobs.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Esta agência não possui vagas ativas no momento.</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {jobs.map(j => (
                    <li key={j.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                      <Link to={`/vaga/${j.slug || j.id}`} className="block">
                        <h3 className="text-sm font-bold text-foreground">{j.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{j.city}{j.state ? ` • ${j.state}` : ''}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AgencyPublicPage;
