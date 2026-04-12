import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CategoryIcon from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink, Award, Clock, GraduationCap, Star, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'empreendedorismo', label: 'Empreendedorismo' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'técnico', label: 'Técnico' },
  { value: 'segurança', label: 'Segurança' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'gestão', label: 'Gestão' },
  { value: 'atendimento', label: 'Atendimento' },
];

const PROVIDERS = [
  { value: 'all', label: 'Todos' },
  { value: 'SEBRAE', label: 'SEBRAE' },
  { value: 'SENAI', label: 'SENAI' },
  { value: 'FGV Online', label: 'FGV' },
  { value: 'Fundação Bradesco', label: 'Fundação Bradesco' },
  { value: 'Google', label: 'Google' },
];

const LEVEL_COLORS: Record<string, string> = {
  iniciante: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  intermediário: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  avançado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CoursesPage = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [provider, setProvider] = useState('all');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('display_order');
      return data || [];
    },
    staleTime: 1000 * 60 * 15,
  });

  const filtered = useMemo(() => {
    return courses.filter((c: any) => {
      if (category !== 'all' && c.category !== category) return false;
      if (provider !== 'all' && c.provider !== provider) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.provider?.toLowerCase().includes(q) ||
          (c.tags as string[])?.some((t: string) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [courses, search, category, provider]);

  const featuredCourses = filtered.filter((c: any) => c.featured);
  const regularCourses = filtered.filter((c: any) => !c.featured);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-accent/10 rounded-full px-4 py-1.5 mb-4">
            <GraduationCap className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">100% Gratuito</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            Portal de Cursos Gratuitos
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Capacite-se gratuitamente com cursos das melhores instituições do Brasil.
            Valorize seu perfil profissional e conquiste mais clientes.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44">
              <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Instituição" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} curso(s) encontrado(s)</p>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Featured */}
        {featuredCourses.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" /> Destaques
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredCourses.map((course: any, i: number) => (
                <CourseCard key={course.id} course={course} index={i} featured />
              ))}
            </div>
          </div>
        )}

        {/* Regular */}
        {regularCourses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {regularCourses.map((course: any, i: number) => (
              <CourseCard key={course.id} course={course} index={i} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum curso encontrado para esta busca.</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center bg-gradient-to-br from-accent/5 to-accent/10 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-foreground mb-2">Quer aparecer para mais clientes?</h2>
          <p className="text-muted-foreground mb-4">
            Complete cursos, adicione certificados ao seu perfil e destaque-se na plataforma.
          </p>
          <Button asChild>
            <a href="/cadastro">Criar meu perfil gratuito</a>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const CourseCard = ({ course, index, featured = false }: { course: any; index: number; featured?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.3 }}
  >
    <a href={course.url} target="_blank" rel="noopener noreferrer" className="block group">
      <Card className={`h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${featured ? 'ring-1 ring-accent/30' : ''}`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${featured ? 'bg-accent/15' : 'bg-muted'}`}>
              <CategoryIcon icon={course.icon} size={22} className={featured ? 'text-accent' : 'text-muted-foreground'} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                {course.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{course.provider}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-accent transition-colors flex-shrink-0 mt-0.5" />
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {course.description}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Clock className="h-2.5 w-2.5 mr-0.5" /> {course.duration}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 border-0 ${LEVEL_COLORS[course.level] || 'bg-muted text-muted-foreground'}`}>
              {course.level}
            </Badge>
            {course.has_certificate && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent/30 text-accent">
                <Award className="h-2.5 w-2.5 mr-0.5" /> Certificado
              </Badge>
            )}
          </div>

          {(course.tags as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {(course.tags as string[]).slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  </motion.div>
);

export default CoursesPage;
