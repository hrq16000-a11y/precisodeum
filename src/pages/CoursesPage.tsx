import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, GraduationCap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CoursesHero from '@/components/courses/CoursesHero';
import CourseCard from '@/components/courses/CourseCard';
import CoursesSkeleton from '@/components/courses/CoursesSkeleton';
import CoursesCta from '@/components/courses/CoursesCta';
import AdSlot from '@/components/ads/AdSlot';

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
  const hasActiveFilters = search || category !== 'all' || provider !== 'all';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <CoursesHero />

        {/* Slot: Topo da listagem */}
        <AdSlot slotSlug="courses-top" layout="banner" className="mb-6" />

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mb-8 bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos, instituições, tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-background/80"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48 bg-background/80">
              <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-full sm:w-48 bg-background/80">
              <SelectValue placeholder="Instituição" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Results count */}
        <AnimatePresence mode="wait">
          <motion.div
            key={filtered.length}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="flex items-center gap-2 text-sm text-muted-foreground mb-6"
          >
            <span className="font-semibold text-foreground">{filtered.length}</span> curso(s) encontrado(s)
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setCategory('all'); setProvider('all'); }}
                className="ml-2 text-xs text-accent hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        {isLoading && <CoursesSkeleton />}

        {/* Featured */}
        {featuredCourses.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-2 bg-warning/10 rounded-full px-4 py-1.5">
                <Sparkles className="h-4 w-4 text-warning" />
                <h2 className="text-sm font-bold text-warning">Destaques</h2>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-warning/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredCourses.map((course: any, i: number) => (
                <CourseCard key={course.id} course={course} index={i} featured />
              ))}
            </div>
          </motion.div>
        )}

        {/* Slot: Entre destaques e regulares */}
        <AdSlot slotSlug="courses-between" layout="banner" className="mb-8" />

        {/* Regular */}
        {regularCourses.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {featuredCourses.length > 0 && (
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-sm font-semibold text-foreground">Todos os cursos</h2>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {regularCourses.map((course: any, i: number) => (
                <CourseCard key={course.id} course={course} index={i + featuredCourses.length} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-4">
              <GraduationCap className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-medium">Nenhum curso encontrado para esta busca.</p>
            <button
              onClick={() => { setSearch(''); setCategory('all'); setProvider('all'); }}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Ver todos os cursos
            </button>
          </motion.div>
        )}

        {/* Slot: Rodapé dos cursos */}
        <AdSlot slotSlug="courses-footer" layout="banner" className="mt-8 mb-4" />

        <CoursesCta />
      </main>
      <Footer />
    </div>
  );
};

export default CoursesPage;
