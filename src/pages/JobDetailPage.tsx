import { useParams, Link } from 'react-router-dom';
import { MapPin, Clock, Phone, MessageCircle, Briefcase, ArrowLeft, Copy, CheckCircle2, DollarSign, Gift, ClipboardList, ShieldCheck } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';

const renderList = (text: string) => {
  if (!text) return null;
  return text.split('\n').filter(l => l.trim()).map((line, i) => (
    <li key={i} className="text-sm text-muted-foreground">{line.replace(/^[-•*]\s*/, '')}</li>
  ));
};

const JobDetailPage = () => {
  const { slug } = useParams();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-detail', slug],
    queryFn: async () => {
      const { data: bySlug } = await supabase.from('jobs').select('*, categories(name, slug, icon)').eq('slug', slug!).maybeSingle();
      if (bySlug) return bySlug;
      const { data: byId } = await supabase.from('jobs').select('*, categories(name, slug, icon)').eq('id', slug!).maybeSingle();
      return byId;
    },
  });

  const pageUrl = `${SITE_BASE_URL}/vaga/${slug}`;

  useSeoHead({
    title: job ? `${job.title} - Vaga em ${job.city || 'Brasil'}` : 'Vaga',
    description: job ? `${job.title} em ${job.city}-${job.state}. ${(job.description || '').slice(0, 120)}` : 'Vaga de serviço.',
    canonical: pageUrl,
  });

  const jobLd = useMemo(() => job ? ({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || '',
    datePosted: job.created_at,
    ...(job.deadline ? { validThrough: job.deadline } : {}),
    employmentType: job.opportunity_type === 'emprego' ? 'FULL_TIME' : 'CONTRACTOR',
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city || '',
        addressRegion: job.state || '',
        addressCountry: 'BR',
      },
    },
    hiringOrganization: {
      '@type': 'Organization',
      name: job.contact_name || 'Preciso de um',
      sameAs: SITE_BASE_URL,
    },
    ...(job.salary ? { baseSalary: { '@type': 'MonetaryAmount', currency: 'BRL', value: { '@type': 'QuantitativeValue', value: job.salary } } } : {}),
  }) : null, [job]);
  useJsonLd(jobLd);

  const copyUrl = () => {
    navigator.clipboard.writeText(pageUrl);
    toast.success('Link copiado!');
  };

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
    ? whatsappLink(job.whatsapp, `Olá! Vi a vaga "${job.title}" no Preciso de um e gostaria de mais informações.`)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/vagas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar para vagas
          </Link>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {job.cover_image_url && (
              <img src={job.cover_image_url} alt={job.title} className="w-full rounded-xl object-cover max-h-80" loading="lazy" />
            )}

            <div>
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
              {job.subtitle && <p className="mt-1 text-base text-muted-foreground">{job.subtitle}</p>}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {job.city && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city}{job.state ? `, ${job.state}` : ''}{job.neighborhood ? ` - ${job.neighborhood}` : ''}</span>
              )}
              {job.deadline && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Prazo: {job.deadline}</span>}
              <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />Publicada em {new Date(job.created_at).toLocaleDateString('pt-BR')}</span>
            </div>

            {/* Description */}
            {job.description && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="font-display text-lg font-bold text-foreground">📋 Descrição da Vaga</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>
              </div>
            )}

            {/* Activities */}
            {job.activities && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <ClipboardList className="h-5 w-5 text-accent" /> Atividades
                </h2>
                <ul className="mt-3 space-y-1.5 list-disc list-inside">{renderList(job.activities)}</ul>
              </div>
            )}

            {/* Requirements */}
            {job.requirements && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-accent" /> Requisitos
                </h2>
                <ul className="mt-3 space-y-1.5 list-disc list-inside">{renderList(job.requirements)}</ul>
              </div>
            )}

            {/* Schedule */}
            {job.schedule && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <Clock className="h-5 w-5 text-accent" /> Horário
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">{job.schedule}</p>
              </div>
            )}

            {/* Salary & Benefits */}
            {(job.salary || job.benefits) && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <DollarSign className="h-5 w-5 text-accent" /> Salário e Benefícios
                </h2>
                {job.salary && <p className="mt-3 text-sm font-medium text-foreground">💰 {job.salary}</p>}
                {job.benefits && (
                  <ul className="mt-2 space-y-1.5 list-disc list-inside">{renderList(job.benefits)}</ul>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
              <h3 className="font-display text-lg font-bold text-foreground">Enviar currículo</h3>
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
              {!whatsappUrl && job.contact_phone && (
                <Button variant="accent" className="w-full" size="lg" asChild>
                  <a href={`tel:${job.contact_phone}`}><Phone className="mr-2 h-5 w-5" /> Ligar</a>
                </Button>
              )}
              <Button variant="outline" className="w-full" size="sm" onClick={copyUrl}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link da vaga
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default JobDetailPage;
