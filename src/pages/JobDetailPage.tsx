import { useParams, Link } from 'react-router-dom';
import { MapPin, Clock, Phone, MessageCircle, ChevronRight, Briefcase, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useMemo } from 'react';

const JobDetailPage = () => {
  const { slug } = useParams();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', slug],
    queryFn: async () => {
      // Try by slug first, then by id
      const { data: bySlug } = await (supabase.from('jobs' as any).select('*, categories(name, slug, icon)') as any).eq('slug', slug).maybeSingle();
      if (bySlug) return bySlug as any;
      const { data: byId } = await (supabase.from('jobs' as any).select('*, categories(name, slug, icon)') as any).eq('id', slug).maybeSingle();
      return byId;
    },
  });

  useSeoHead({
    title: job ? `${job.title} - Vaga em ${job.city}` : 'Vaga',
    description: job ? `${job.title} em ${job.city}-${job.state}. ${job.description?.slice(0, 120)}` : 'Vaga de serviço na plataforma.',
    canonical: slug ? `${SITE_BASE_URL}/vaga/${slug}` : undefined,
  });

  const jobLd = useMemo(() => job ? ({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.created_at,
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: job.city, addressRegion: job.state, addressCountry: 'BR' },
    },
  }) : null, [job]);
  useJsonLd(jobLd);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container py-8"><Skeleton className="h-64 rounded-xl" /></div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Vaga não encontrada.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const whatsappUrl = job.whatsapp
    ? `https://wa.me/55${job.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi a vaga "${job.title}" no Preciso de um e gostaria de mais informações.`)}`
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-8">
        <Link to="/vagas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar para vagas
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {job.cover_image_url && (
              <img src={job.cover_image_url} alt={job.title} className="mb-6 w-full rounded-xl object-cover max-h-80" />
            )}

            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {job.opportunity_type === 'emprego' ? 'Emprego' : job.opportunity_type === 'freelance' ? 'Freelance' : 'Serviço'}
                  </span>
                  {(job.categories as any)?.name && (
                    <span className="text-xs text-muted-foreground">{(job.categories as any)?.icon} {(job.categories as any)?.name}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {job.status === 'active' ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold text-foreground lg:text-3xl">{job.title}</h1>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {job.city && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city}{job.state ? `, ${job.state}` : ''}{job.neighborhood ? ` - ${job.neighborhood}` : ''}</span>
              )}
              {job.deadline && (
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Prazo: {job.deadline}</span>
              )}
              <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />Publicada em {new Date(job.created_at).toLocaleDateString('pt-BR')}</span>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Descrição da Vaga</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
              <h3 className="font-display text-lg font-bold text-foreground">Contato</h3>
              {job.contact_name && <p className="text-sm font-medium text-foreground">{job.contact_name}</p>}
              {job.contact_phone && (
                <a href={`tel:${job.contact_phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Phone className="h-4 w-4" /> {job.contact_phone}
                </a>
              )}
              {whatsappUrl && (
                <Button variant="accent" className="w-full" size="lg" asChild>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" /> Chamar no WhatsApp
                  </a>
                </Button>
              )}
              {job.contact_phone && !whatsappUrl && (
                <Button variant="accent" className="w-full" size="lg" asChild>
                  <a href={`tel:${job.contact_phone}`}>
                    <Phone className="mr-2 h-5 w-5" /> Ligar
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default JobDetailPage;
