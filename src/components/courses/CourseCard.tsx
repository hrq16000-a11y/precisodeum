import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CategoryIcon from '@/components/CategoryIcon';
import { ExternalLink, Award, Clock, Sparkles } from 'lucide-react';

const LEVEL_COLORS: Record<string, string> = {
  iniciante: 'bg-success/15 text-success dark:bg-success/10',
  intermediário: 'bg-warning/15 text-warning dark:bg-warning/10',
  avançado: 'bg-destructive/15 text-destructive dark:bg-destructive/10',
};

interface CourseCardProps {
  course: any;
  index: number;
  featured?: boolean;
}

const CourseCard = ({ course, index, featured = false }: CourseCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.97 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, margin: '-30px' }}
    transition={{ delay: index * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
  >
    <a href={course.url} target="_blank" rel="noopener noreferrer" className="block group">
      <Card className={`
        h-full transition-all duration-400 ease-out
        hover:shadow-xl hover:-translate-y-1.5 hover:shadow-accent/5
        border-border/60
        ${featured
          ? 'bg-gradient-to-br from-card via-card to-accent/[0.03] ring-1 ring-accent/20 shadow-md shadow-accent/5'
          : 'hover:border-accent/20'
        }
      `}>
        <CardContent className="p-5 relative overflow-hidden">
          {/* Decorative corner glow for featured */}
          {featured && (
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          )}

          <div className="flex items-start gap-3 mb-3 relative">
            <motion.div
              whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
              transition={{ duration: 0.5 }}
              className={`
                flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center
                transition-colors duration-300
                ${featured
                  ? 'bg-gradient-to-br from-accent/20 to-accent/10 shadow-sm shadow-accent/10'
                  : 'bg-muted group-hover:bg-accent/10'
                }
              `}
            >
              <CategoryIcon
                icon={course.icon}
                size={22}
                className={`transition-colors duration-300 ${featured ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'}`}
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors duration-300 line-clamp-2 leading-snug">
                {course.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {featured && <Sparkles className="h-3 w-3 text-accent animate-pulse" />}
                {course.provider}
              </p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0 mt-0.5" />
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {course.description}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
              <Clock className="h-2.5 w-2.5" /> {course.duration}
            </Badge>
            <Badge className={`text-[10px] px-2 py-0.5 border-0 ${LEVEL_COLORS[course.level] || 'bg-muted text-muted-foreground'}`}>
              {course.level}
            </Badge>
            {course.has_certificate && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-accent/30 text-accent gap-1">
                <Award className="h-2.5 w-2.5" /> Certificado
              </Badge>
            )}
          </div>

          {(course.tags as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {(course.tags as string[]).slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-[9px] bg-muted/80 px-2 py-0.5 rounded-full text-muted-foreground font-medium">
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

export default CourseCard;
