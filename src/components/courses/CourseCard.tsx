import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CategoryIcon from '@/components/CategoryIcon';
import { ExternalLink, Award, Clock, Sparkles, Heart, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LEVEL_COLORS: Record<string, string> = {
  iniciante: 'bg-success/15 text-success dark:bg-success/10',
  intermediário: 'bg-warning/15 text-warning dark:bg-warning/10',
  avançado: 'bg-destructive/15 text-destructive dark:bg-destructive/10',
};

const MOTIVATIONAL_TIPS: Record<string, string> = {
  empreendedorismo: 'Valorize seu negócio',
  vendas: 'Aumente seus ganhos',
  marketing: 'Atraia mais clientes',
  financeiro: 'Organize suas finanças',
  técnico: 'Aprimore suas habilidades',
  segurança: 'Trabalhe com segurança',
  tecnologia: 'Domine a tecnologia',
  gestão: 'Lidere com confiança',
  atendimento: 'Encante seus clientes',
};

interface CourseCardProps {
  course: any;
  index: number;
  featured?: boolean;
}

const CourseCard = ({ course, index, featured = false }: CourseCardProps) => {
  const tip = MOTIVATIONAL_TIPS[course.category] || 'Invista em você';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="block group">
        <Card className={`
          h-full transition-all duration-400 ease-out overflow-hidden
          hover:shadow-xl hover:-translate-y-1.5 hover:shadow-accent/5
          border-border/60
          ${featured
            ? 'ring-1 ring-accent/20 shadow-md shadow-accent/5'
            : 'hover:border-accent/20'
          }
        `}>
          {/* Cover Image */}
          {course.image_url && (
            <div className="relative h-40 overflow-hidden">
              <img
                src={course.image_url}
                alt={course.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent" />
              
              {/* Featured badge */}
              {featured && (
                <div className="absolute top-2.5 left-2.5">
                  <Badge className="bg-accent/90 text-accent-foreground backdrop-blur-sm text-[10px] gap-1 px-2 py-0.5 shadow-sm">
                    <Sparkles className="h-3 w-3" /> Destaque
                  </Badge>
                </div>
              )}

              {/* Certificate badge on image */}
              {course.has_certificate && (
                <div className="absolute top-2.5 right-2.5">
                  <Badge className="bg-card/80 backdrop-blur-sm text-accent text-[10px] gap-1 px-2 py-0.5 border border-accent/20 shadow-sm">
                    <Award className="h-3 w-3" /> Certificado
                  </Badge>
                </div>
              )}

              {/* Provider on image */}
              <div className="absolute bottom-2.5 left-2.5">
                <span className="text-[11px] font-semibold text-foreground bg-card/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-border/30 shadow-sm">
                  {course.provider}
                </span>
              </div>

              {/* Motivational tip */}
              <div className="absolute bottom-2.5 right-2.5">
                <span className="text-[10px] text-muted-foreground bg-card/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  {tip}
                </span>
              </div>
            </div>
          )}

          {/* No image fallback */}
          {!course.image_url && (
            <div className={`relative h-28 flex items-center justify-center ${featured ? 'bg-gradient-to-br from-accent/10 to-accent/5' : 'bg-muted/50'}`}>
              <CategoryIcon icon={course.icon} size={36} className={featured ? 'text-accent/40' : 'text-muted-foreground/30'} />
              {featured && (
                <div className="absolute top-2.5 left-2.5">
                  <Badge className="bg-accent/90 text-accent-foreground text-[10px] gap-1 px-2 py-0.5">
                    <Sparkles className="h-3 w-3" /> Destaque
                  </Badge>
                </div>
              )}
            </div>
          )}

          <CardContent className="p-4 relative">
            <div className="flex items-start gap-2.5 mb-2">
              <motion.div
                whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                transition={{ duration: 0.5 }}
                className={`
                  flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center
                  transition-colors duration-300
                  ${featured
                    ? 'bg-gradient-to-br from-accent/20 to-accent/10 shadow-sm shadow-accent/10'
                    : 'bg-muted group-hover:bg-accent/10'
                  }
                `}
              >
                <CategoryIcon
                  icon={course.icon}
                  size={20}
                  className={`transition-colors duration-300 ${featured ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'}`}
                />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors duration-300 line-clamp-2 leading-snug">
                  {course.title}
                </h3>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0 mt-0.5" />
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {course.description}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
                <Clock className="h-2.5 w-2.5" /> {course.duration}
              </Badge>
              <Badge className={`text-[10px] px-2 py-0.5 border-0 ${LEVEL_COLORS[course.level] || 'bg-muted text-muted-foreground'}`}>
                {course.level}
              </Badge>
            </div>

            {(course.tags as string[])?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(course.tags as string[]).slice(0, 3).map((tag: string) => (
                  <span key={tag} className="text-[9px] bg-muted/80 px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link to={`/cursos/${course.id}`}>Detalhes</Link>
              </Button>
              <Button asChild size="sm" className="h-8 gap-1 text-xs">
                <a href={course.url} target="_blank" rel="noopener noreferrer">
                  Inscrição <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>

            {/* Motivational footer */}
            <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-accent/50" />
              <span className="text-[10px] text-muted-foreground/80 italic">
                Capacite-se e conquiste mais clientes
              </span>
              <TrendingUp className="h-3 w-3 text-success/50 ml-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default CourseCard;
