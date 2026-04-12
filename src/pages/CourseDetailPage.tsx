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
import { useSponsorsBySlot } from '@/hooks/useSponsors';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, Award, Clock, GraduationCap,
  BookOpen, Share2, Users, Sparkles, TrendingUp, ChevronRight,
  CheckCircle2, ChevronLeft,
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  iniciante: { label: 'Iniciante', color: 'bg-success/15 text-success' },
  intermediário: { label: 'Intermediário', color: 'bg-warning/15 text-warning' },
  avançado: { label: 'Avançado', color: 'bg-destructive/15 text-destructive' },
};

const BENEFITS = [
  'Certificado reconhecido pelo mercado',
  'Estude no seu próprio ritmo',
  'Sem pré-requisitos obrigatórios',
  'Conteúdo atualizado constantemente',
  'Acesse de qualquer dispositivo',
  'Material complementar incluso',
];

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
        .limit(3);
      return data || [];
    },
    enabled: !!course?.category,
  });

  // Sponsor slots
  const { data: topSponsors = [], trackImpression: trackTopImp } = useSponsorsBySlot('banner');
  const { data: sideSponsors = [], trackImpression: trackSideImp } = useSponsorsBySlot('sidebar');
  const { data: midSponsors = [], trackImpression: trackMidImp } = useSponsorsBySlot('mid-content');

  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topSponsors.forEach(s => trackTopImp(s.id));
  }, [topSponsors]);
  useEffect(() => {
    sideSponsors.forEach(s => trackSideImp(s.id));
  }, [sideSponsors]);
  useEffect(() => {
    midSponsors.forEach(s => trackMidImp(s.id));
  }, [midSponsors]);

  const level = LEVEL_LABELS[course?.level ?? ''] ?? LEVEL_LABELS.iniciante;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: course?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full rounded-2xl mb-6" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20 text-center max-w-6xl">
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/cursos" className="hover:text-foreground transition-colors">Cursos</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{course.title}</span>
        </nav>

        {/* Top sponsor banner — single rotating */}
        {topSponsors.length > 0 && (
          <TopBannerCarousel sponsors={topSponsors} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero card */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="overflow-hidden border-border/60">
                {course.image_url && (
                  <div className="relative h-56 md:h-72 overflow-hidden">
                    <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {course.featured && (
                          <Badge className="bg-accent/90 text-accent-foreground text-xs gap-1">
                            <Sparkles className="h-3 w-3" /> Destaque
                          </Badge>
                        )}
                        {course.has_certificate && (
                          <Badge className="bg-card/80 backdrop-blur-sm text-accent text-xs gap-1 border border-accent/20">
                            <Award className="h-3 w-3" /> Certificado
                          </Badge>
                        )}
                        <Badge className={`text-xs border-0 ${level.color}`}>{level.label}</Badge>
                      </div>
                    </div>
                  </div>
                )}

                <CardContent className="p-5 md:p-8">
                  {/* Provider + Category */}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                      {course.provider_logo_url ? (
                        <img src={course.provider_logo_url} alt={course.provider} className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold text-foreground">{course.provider}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Clock className="h-3 w-3" /> {course.duration}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4 leading-tight">
                    {course.title}
                  </h1>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed text-sm md:text-base mb-6">
                    {course.description}
                  </p>

                  {/* Tags */}
                  {(course.tags as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {(course.tags as string[]).map((tag: string) => (
                        <span key={tag} className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a href={course.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full gap-2 h-12 text-base font-bold">
                        <ExternalLink className="h-5 w-5" /> Acessar Curso Gratuito
                      </Button>
                    </a>
                    <Button variant="outline" onClick={handleShare} className="gap-2 h-12">
                      <Share2 className="h-4 w-4" /> Compartilhar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mid-content sponsor */}
            {midSponsors.length > 0 && (
              <div className="space-y-3">
                {midSponsors.map(s => (
                  <a key={s.id} href={s.link_url || s.external_link} target="_blank" rel="noopener noreferrer sponsored" className="block">
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-4 p-4">
                        {(s.image_url || s.logo_url) && (
                          <img src={s.image_url || s.logo_url} alt={s.title} className="h-16 w-16 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Patrocinado</p>
                          <p className="font-semibold text-sm text-foreground">{s.title}</p>
                          {s.short_description && <p className="text-xs text-muted-foreground line-clamp-1">{s.short_description}</p>}
                        </div>
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            )}

            {/* Benefits section */}
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card>
                <CardContent className="p-5 md:p-8">
                  <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" /> Por que fazer este curso?
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BENEFITS.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        </div>
                        <span className="text-sm text-muted-foreground">{b}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Related courses */}
            {relatedCourses.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-foreground">Cursos relacionados</h2>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {relatedCourses.map((rc: any) => (
                    <Link key={rc.id} to={`/cursos/${rc.id}`} className="group">
                      <Card className="h-full hover:shadow-md hover:-translate-y-0.5 transition-all border-border/60">
                        {rc.image_url && (
                          <div className="h-28 overflow-hidden rounded-t-lg">
                            <img src={rc.image_url} alt={rc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          </div>
                        )}
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2 mb-1.5">
                            <CategoryIcon icon={rc.icon} size={16} className="text-muted-foreground mt-0.5" />
                            <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors">{rc.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{rc.provider}</span>
                            <span>•</span>
                            <span>{rc.duration}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Quick info card */}
            <Card className="sticky top-24">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CategoryIcon icon={course.icon} size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.provider}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Duração</span>
                    <span className="font-semibold text-foreground">{course.duration}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Nível</span>
                    <Badge className={`text-xs border-0 ${level.color}`}>{level.label}</Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Certificado</span>
                    <span className="font-semibold text-foreground">{course.has_certificate ? 'Sim ✅' : 'Não'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Preço</span>
                    <span className="font-bold text-success">Gratuito</span>
                  </div>
                </div>

                <a href={course.url} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2 h-11 font-bold">
                    <ExternalLink className="h-4 w-4" /> Inscreva-se Grátis
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Sidebar sponsors */}
            {sideSponsors.length > 0 && (
              <div className="space-y-3">
                {sideSponsors.map(s => (
                  <a key={s.id} href={s.link_url || s.external_link} target="_blank" rel="noopener noreferrer sponsored">
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground mb-2">Patrocinado</p>
                        {(s.image_url || s.logo_url) && (
                          <img src={s.image_url || s.logo_url} alt={s.title} className="w-full h-auto rounded-lg object-cover mb-2" loading="lazy" />
                        )}
                        <p className="text-xs font-semibold text-foreground">{s.title}</p>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            )}

            {/* CTA card */}
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-accent/20">
              <CardContent className="p-5 text-center">
                <Users className="h-8 w-8 text-accent mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground mb-1">Precisa de um profissional?</p>
                <p className="text-xs text-muted-foreground mb-3">Encontre prestadores qualificados na sua região.</p>
                <Link to="/buscar">
                  <Button variant="outline" size="sm" className="gap-1.5 w-full">
                    <TrendingUp className="h-3.5 w-3.5" /> Buscar profissional
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CourseDetailPage;
