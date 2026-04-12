import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { GraduationCap, BookOpen, Award, ArrowRight, Sparkles, TrendingUp, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const highlights = [
  { icon: GraduationCap, label: '100% Gratuito', desc: 'Sem custos, sem taxas' },
  { icon: Award, label: 'Certificado', desc: 'Reconhecido pelo mercado' },
  { icon: BookOpen, label: 'SEBRAE, SENAI, FGV', desc: 'Instituições renomadas' },
  { icon: TrendingUp, label: 'Mais Clientes', desc: 'Destaque na plataforma' },
];

const CoursesPromo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const navigate = useNavigate();

  return (
    <section ref={ref} className="py-16 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/90 p-8 md:p-14">
          {/* Decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }} />
          </div>

          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            {/* Left — text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
              >
                <Badge className="mb-4 bg-white/10 text-primary-foreground border border-white/20 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 mr-1" /> Portal de Capacitação
                </Badge>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-2xl md:text-4xl font-extrabold text-primary-foreground leading-tight mb-4"
              >
                Invista no seu{' '}
                <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                  futuro profissional
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-primary-foreground/70 text-sm md:text-base leading-relaxed mb-6 max-w-md"
              >
                Cursos gratuitos das melhores instituições do Brasil. Conquiste certificados,
                aprimore suas habilidades e atraia mais clientes.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground shadow-xl shadow-secondary/30 hover:shadow-2xl group"
                  onClick={() => navigate('/cursos')}
                >
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Ver Cursos Gratuitos
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </div>

            {/* Right — cards grid */}
            <div className="grid grid-cols-2 gap-3">
              {highlights.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors group cursor-default"
                >
                  <motion.div
                    className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3"
                    whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                  >
                    <item.icon className="w-5 h-5 text-amber-300" />
                  </motion.div>
                  <h3 className="text-sm font-bold text-primary-foreground mb-0.5">{item.label}</h3>
                  <p className="text-[11px] text-primary-foreground/50">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom trust bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="relative flex items-center justify-center gap-6 mt-8 pt-6 border-t border-white/10 flex-wrap"
          >
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <Heart className="w-3 h-3" /> Valorize sua carreira
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <Award className="w-3 h-3" /> Certificados reconhecidos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <TrendingUp className="w-3 h-3" /> Destaque na plataforma
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CoursesPromo;
