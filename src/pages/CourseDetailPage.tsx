import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import CategoryIcon from '@/components/CategoryIcon';
import AdSlot from '@/components/ads/AdSlot';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, Award, Clock, GraduationCap,
  BookOpen, Share2, Users, Sparkles, TrendingUp, ChevronRight,
  CheckCircle2, Calendar, MapPin, DollarSign, Target, Briefcase,
  Star, ArrowRight, FileText, Shield, Lightbulb,
} from 'lucide-react';

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  iniciante: { label: 'Iniciante', color: 'bg-success/15 text-success' },
  intermediário: { label: 'Intermediário', color: 'bg-warning/15 text-warning' },
  avançado: { label: 'Avançado', color: 'bg-destructive/15 text-destructive' },
};

const CourseDetailPage = () => {
  const { courseId } = useParams<{ courseId: string }>();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId!)
        .eq('active', true)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: relatedCourses = [] } = useQuery({
    queryKey: ['courses-related', course?.category, courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('active', true)
        .eq('category', course!.category)
        .neq('id', courseId!)
        .order('featured', { ascending: false })
        .limit(4);
      return data || [];
    },
    enabled: !!course?.category,
  });

  const level = LEVEL_LABELS[course?.level ?? ''] ?? LEVEL_LABELS.iniciante;

  // SEO
  useSeoHead({
    title: course?.title ? `${course.title} - Curso Gratuito` : 'Carregando curso...',
    description: course?.description?.slice(0, 155) || 'Curso gratuito com certificado reconhecido pelo mercado. Capacite-se e conquiste mais oportunidades.',
    ogImage: course?.image_url || undefined,
    ogType: 'article',
    articlePublishedTime: course?.created_at,
    articleModifiedTime: course?.updated_at,
    articleAuthor: course?.provider,
  });

  // JSON-LD Course schema
  useJsonLd(course ? {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: course.provider,
    },
    isAccessibleForFree: true,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: course.duration,
    },
    educationalLevel: course.level,
    ...(course.image_url ? { image: course.image_url } : {}),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
  } : null);

  const handleShare = () => {
    const shareData = {
      title: course?.title,
      text: `${course?.title} - Curso gratuito com certificado! Confira:`,
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Determine if it's a Petrobras/Autonomia e Renda course
  const isPetrobras = course?.tags?.some((t: string) =>
    ['petrobras', 'autonomia e renda'].includes(t.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-6 w-64 mb-6" />
          <Skeleton className="h-[360px] w-full rounded-2xl mb-6" />
          <Skeleton className="h-10 w-3/4 mb-3" />
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-5 w-2/3 mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20 text-center max-w-4xl">
          <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Curso não encontrado</h1>
          <p className="text-muted-foreground mb-6">Este curso pode ter sido removido ou desativado.</p>
          <Link to="/cursos">
            <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar aos cursos</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const readingTime = Math.max(3, Math.ceil((course.description?.length || 200) / 200));
  const publishDate = new Date(course.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Article-style layout */}
      <article className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5 flex-wrap" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/cursos" className="hover:text-foreground transition-colors">Cursos Gratuitos</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[250px]">{course.title}</span>
        </nav>

        {/* Category badge */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-xs uppercase tracking-wider font-bold">
            {course.category}
          </Badge>
          {course.featured && (
            <Badge className="bg-accent/90 text-accent-foreground text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Destaque
            </Badge>
          )}
        </div>

        {/* Title — large, editorial */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground leading-tight mb-4"
        >
          {course.title}
        </motion.h1>

        {/* Subtitle / excerpt */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-5 max-w-3xl"
        >
          {course.description?.slice(0, 180)}
          {(course.description?.length || 0) > 180 ? '...' : ''}
        </motion.p>

        {/* Author / meta bar — like portaltemponovo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-4 flex-wrap py-3 mb-6 border-y border-border/40"
        >
          <div className="flex items-center gap-2">
            {course.provider_logo_url ? (
              <img src={course.provider_logo_url} alt={course.provider} className="h-8 w-8 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="font-bold text-sm text-foreground uppercase tracking-wide">{course.provider}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{publishDate}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{readingTime} min de leitura</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5 text-xs h-8">
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </Button>
          </div>
        </motion.div>

        {/* Hero image — full width */}
        {course.image_url && (
          <motion.figure
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 -mx-4 sm:mx-0"
          >
            <div className="relative overflow-hidden rounded-none sm:rounded-2xl aspect-video">
              <img
                src={course.image_url}
                alt={course.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              {/* Badges on image */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                {course.has_certificate && (
                  <Badge className="bg-white/90 text-foreground text-xs gap-1 shadow-sm backdrop-blur-sm">
                    <Award className="h-3 w-3 text-accent" /> Certificado incluso
                  </Badge>
                )}
                <Badge className="bg-white/90 text-success text-xs font-bold shadow-sm backdrop-blur-sm">
                  <DollarSign className="h-3 w-3" /> 100% Gratuito
                </Badge>
              </div>
            </div>
            <figcaption className="text-xs text-muted-foreground mt-2 px-4 sm:px-0">
              {course.provider} - Programa de capacitação profissional gratuita
            </figcaption>
          </motion.figure>
        )}

        {/* Ad slot */}
        <AdSlot slotSlug="course-detail-top" layout="banner" className="mb-8" />

        {/* Quick info cards — key facts grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Duração</p>
            <p className="font-bold text-sm text-foreground">{course.duration}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <Target className="h-5 w-5 text-warning mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Nível</p>
            <p className="font-bold text-sm text-foreground capitalize">{course.level}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <Award className="h-5 w-5 text-accent mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Certificado</p>
            <p className="font-bold text-sm text-foreground">{course.has_certificate ? 'Sim (MEC)' : 'Não'}</p>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
            <DollarSign className="h-5 w-5 text-success mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Investimento</p>
            <p className="font-bold text-sm text-success">Gratuito</p>
          </div>
        </motion.div>

        {/* CTA primary — prominent */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-5 sm:p-6 mb-8 flex flex-col sm:flex-row items-center gap-4"
        >
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-primary-foreground mb-1">Inscreva-se gratuitamente</h2>
            <p className="text-sm text-primary-foreground/70">
              Vagas limitadas. Garanta sua vaga neste curso com certificado reconhecido.
            </p>
          </div>
          <a href={course.url} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-bold gap-2 shadow-lg whitespace-nowrap">
              <ExternalLink className="h-5 w-5" /> Acessar Inscrição
            </Button>
          </a>
        </motion.div>

        {/* Article body — rich content sections */}
        <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert mb-10">
          {/* Full description */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4 not-prose">
              <FileText className="h-5 w-5 text-primary" /> Sobre o Curso
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base whitespace-pre-line">
              {course.description}
            </p>
            {isPetrobras && (
              <div className="bg-accent/5 border-l-4 border-accent rounded-r-xl p-4 mt-4 not-prose">
                <p className="text-sm text-foreground font-medium mb-1">
                  Programa Autonomia e Renda Petrobras
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Este curso faz parte do Programa Autonomia e Renda, desenvolvido pela Petrobras em parceria
                  com o SENAI e Institutos Federais, com foco na formação de profissionais para o setor industrial
                  e energético. Os participantes selecionados recebem auxílio financeiro mensal de até R$ 800
                  durante o período de formação.
                </p>
              </div>
            )}
          </motion.section>

          {/* Benefits */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 not-prose"
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-5 w-5 text-success" /> Por que fazer este curso?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Award, text: 'Certificado reconhecido pelo MEC e pelo mercado' },
                { icon: DollarSign, text: '100% gratuito - sem custos ou taxas ocultas' },
                { icon: Clock, text: 'Estude no seu próprio ritmo e horário' },
                { icon: Briefcase, text: 'Formação alinhada às demandas do mercado' },
                { icon: Shield, text: 'Material didático completo e atualizado' },
                { icon: Lightbulb, text: 'Conteúdo prático com aplicação imediata' },
                ...(isPetrobras ? [
                  { icon: DollarSign, text: 'Auxílio financeiro mensal de até R$ 800' },
                  { icon: MapPin, text: 'Vagas em diversas regiões do Brasil' },
                ] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-card border border-border/40 rounded-xl p-3.5 hover:border-success/30 transition-colors">
                  <div className="mt-0.5 h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-success" />
                  </div>
                  <span className="text-sm text-foreground leading-snug">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* How to enroll — step by step (editorial style) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 not-prose"
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-5">
              <GraduationCap className="h-5 w-5 text-primary" /> Como se inscrever
            </h2>
            <div className="space-y-4">
              {[
                { step: 1, title: 'Acesse o site do curso', desc: 'Clique no botão "Acessar Inscrição" acima para ir diretamente à página oficial do programa.' },
                { step: 2, title: 'Confira os requisitos', desc: 'Verifique os pré-requisitos de escolaridade e localização exigidos para este curso específico.' },
                { step: 3, title: 'Faça seu cadastro', desc: 'Crie uma conta na plataforma do curso com seus dados pessoais e documentos necessários.' },
                { step: 4, title: 'Aguarde a seleção', desc: 'Acompanhe as etapas do processo seletivo e fique atento às convocações e prazos.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {s.step}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="font-bold text-foreground text-sm mb-0.5">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Tags */}
          {(course.tags as string[])?.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-8 not-prose"
            >
              <div className="flex flex-wrap gap-2">
                {(course.tags as string[]).map((tag: string) => (
                  <span key={tag} className="text-xs bg-muted/80 px-3 py-1.5 rounded-full text-muted-foreground font-medium hover:bg-muted transition-colors">
                    #{tag}
                  </span>
                ))}
              </div>
            </motion.section>
          )}
        </div>

        {/* Mid content ad */}
        <AdSlot slotSlug="course-detail-mid" layout="native" className="mb-8" />

        {/* Second CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card border-2 border-accent/20 rounded-2xl p-6 mb-10 text-center"
        >
          <GraduationCap className="h-10 w-10 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground mb-2">Não perca esta oportunidade</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            As vagas são limitadas e os cursos gratuitos com certificado fazem toda a diferença no seu currículo profissional.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={course.url} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="gap-2 font-bold">
                <ExternalLink className="h-5 w-5" /> Inscreva-se Agora
              </Button>
            </a>
            <Button variant="outline" size="lg" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" /> Compartilhar com amigos
            </Button>
          </div>
        </motion.div>

        {/* FAQ section for SEO */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-xl font-bold text-foreground mb-5 flex items-center gap-2">
            <Star className="h-5 w-5 text-warning" /> Perguntas frequentes sobre este curso
          </h2>
          <div className="space-y-3">
            {[
              { q: `O curso "${course.title}" é realmente gratuito?`, a: `Sim, este curso é 100% gratuito. Não há custos de matrícula, mensalidade ou material didático. ${isPetrobras ? 'Além disso, o Programa Autonomia e Renda oferece auxílio financeiro mensal aos participantes selecionados.' : ''}` },
              { q: 'Preciso ter experiência prévia para me inscrever?', a: `O nível deste curso é "${course.level}". ${course.level === 'iniciante' ? 'Não é necessária experiência prévia, sendo ideal para quem está começando na área.' : 'É recomendável ter conhecimentos básicos na área para melhor aproveitamento do conteúdo.'}` },
              { q: 'O certificado é reconhecido pelo mercado?', a: course.has_certificate ? `Sim, ao concluir o curso você recebe um certificado emitido por ${course.provider}, reconhecido pelo mercado de trabalho e que pode ser adicionado ao seu currículo e perfil profissional.` : 'Este curso não oferece certificado de conclusão, mas o conhecimento adquirido é valioso para o seu desenvolvimento profissional.' },
              { q: 'Qual é a carga horária do curso?', a: `A carga horária total do curso é de ${course.duration}. O conteúdo pode ser acessado de acordo com sua disponibilidade, permitindo flexibilidade nos estudos.` },
            ].map((faq, i) => (
              <details key={i} className="bg-card border border-border/50 rounded-xl overflow-hidden group">
                <summary className="cursor-pointer p-4 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors flex items-center justify-between">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform flex-shrink-0 ml-2" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </motion.section>

        {/* Related courses — editorial "Leia também" style */}
        {relatedCourses.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold text-foreground">Cursos relacionados</h2>
              <div className="flex-1 h-px bg-border/50" />
              <Link to="/cursos" className="text-xs text-accent hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedCourses.map((rc: any) => (
                <Link key={rc.id} to={`/cursos/${rc.id}`} className="group">
                  <Card className="h-full hover:shadow-md hover:-translate-y-0.5 transition-all border-border/60 overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {rc.image_url ? (
                        <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                          <img src={rc.image_url} alt={rc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                        </div>
                      ) : (
                        <div className="w-24 h-20 flex-shrink-0 rounded-lg bg-muted/50 flex items-center justify-center">
                          <CategoryIcon icon={rc.icon} size={24} className="text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-snug mb-1">
                          {rc.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{rc.provider}</span>
                          <span className="text-border">|</span>
                          <span>{rc.duration}</span>
                        </div>
                        {rc.has_certificate && (
                          <div className="flex items-center gap-1 text-xs text-accent mt-1">
                            <Award className="h-3 w-3" /> Certificado
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* CTA — find a professional */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-accent/20 mb-6">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="font-bold text-foreground mb-1">Precisa de um profissional qualificado?</p>
              <p className="text-sm text-muted-foreground">Encontre prestadores de serviço certificados na sua região.</p>
            </div>
            <Link to="/buscar">
              <Button variant="outline" className="gap-2 whitespace-nowrap">
                <Users className="h-4 w-4" /> Buscar profissional
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Ad slot footer */}
        <AdSlot slotSlug="course-detail-sidebar" layout="banner" className="mb-4" />
      </article>

      <Footer />
    </div>
  );
};

export default CourseDetailPage;
