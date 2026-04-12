import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Star, TrendingUp, Award, GraduationCap } from 'lucide-react';

const CoursesCta = () => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
    className="mt-20 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/90 p-10 md:p-14 text-center"
  >
    {/* Pattern */}
    <div className="absolute inset-0 opacity-[0.03]" style={{
      backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)',
      backgroundSize: '30px 30px',
    }} />

    {/* Gradient orbs */}
    <div className="absolute -top-20 -right-20 w-60 h-60 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

    {/* Floating elements */}
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity }}
      className="absolute top-6 right-12 text-white/10"
    >
      <Star className="h-8 w-8" />
    </motion.div>
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, delay: 1 }}
      className="absolute bottom-8 left-10 text-white/10"
    >
      <GraduationCap className="h-6 w-6" />
    </motion.div>

    <motion.div
      initial={{ scale: 0 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      className="relative inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 text-xs font-semibold text-amber-300 border border-white/15"
    >
      <Sparkles className="h-3.5 w-3.5" /> Destaque-se na plataforma
    </motion.div>

    <h2 className="relative text-2xl md:text-4xl font-extrabold text-primary-foreground mb-3">
      Seu talento merece ser{' '}
      <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
        reconhecido
      </span>
    </h2>
    <p className="relative text-primary-foreground/60 mb-6 max-w-lg mx-auto">
      Complete cursos, adicione certificados ao seu perfil e mostre para seus clientes
      que você é um profissional que investe na qualidade.
    </p>

    {/* Trust indicators */}
    <div className="flex items-center justify-center gap-5 mb-8 flex-wrap">
      {[
        { icon: <TrendingUp className="h-4 w-4 text-amber-300/80" />, text: 'Mais visibilidade' },
        { icon: <Star className="h-4 w-4 text-amber-300/80" />, text: 'Destaque no ranking' },
        { icon: <Award className="h-4 w-4 text-amber-300/80" />, text: 'Confiança dos clientes' },
      ].map((item) => (
        <div key={item.text} className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
          {item.icon}
          <span>{item.text}</span>
        </div>
      ))}
    </div>

    <Button asChild size="lg" className="relative group shadow-xl shadow-secondary/20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
      <a href="/cadastro">
        Criar meu perfil gratuito
        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </a>
    </Button>
  </motion.div>
);

export default CoursesCta;
