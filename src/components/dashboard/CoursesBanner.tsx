import { motion } from 'framer-motion';
import { GraduationCap, ArrowRight, Sparkles, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const CoursesBanner = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/90 p-5 md:p-6 border border-primary/20"
    >
      {/* Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-4 flex-wrap">
        <motion.div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <GraduationCap className="h-6 w-6 text-amber-300" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-primary-foreground">Capacite-se Gratuitamente</h3>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <p className="text-xs text-primary-foreground/60 leading-relaxed">
            Cursos gratuitos do SEBRAE, SENAI e FGV com certificado. Invista no seu futuro e conquiste mais clientes!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-primary-foreground/40 bg-white/5 rounded-full px-2.5 py-1">
            <Award className="w-3 h-3" /> Com certificado
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground shadow-lg shadow-secondary/20 group"
            onClick={() => navigate('/cursos')}
          >
            Ver Cursos
            <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default CoursesBanner;
