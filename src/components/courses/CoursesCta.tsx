import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Heart, Star, TrendingUp } from 'lucide-react';

const CoursesCta = () => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
    className="mt-20 relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/5 via-accent/10 to-primary/5 border border-accent/10 p-10 md:p-14 text-center"
  >
    {/* Decorative orbs */}
    <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

    {/* Floating elements */}
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity }}
      className="absolute top-6 right-12 text-accent/15"
    >
      <Star className="h-8 w-8" />
    </motion.div>
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, delay: 1 }}
      className="absolute bottom-8 left-10 text-primary/15"
    >
      <Heart className="h-6 w-6" />
    </motion.div>

    <motion.div
      initial={{ scale: 0 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      className="inline-flex items-center gap-1.5 bg-accent/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 text-xs font-semibold text-accent"
    >
      <Sparkles className="h-3.5 w-3.5" /> Destaque-se na plataforma
    </motion.div>

    <h2 className="relative text-2xl md:text-3xl font-bold text-foreground mb-3">
      Seu talento merece ser{' '}
      <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
        reconhecido
      </span>
    </h2>
    <p className="relative text-muted-foreground mb-4 max-w-lg mx-auto">
      Complete cursos, adicione certificados ao seu perfil e mostre para seus clientes
      que você é um profissional que investe na qualidade.
    </p>

    {/* Trust indicators */}
    <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
      {[
        { icon: <TrendingUp className="h-4 w-4 text-success" />, text: 'Mais visibilidade' },
        { icon: <Star className="h-4 w-4 text-warning" />, text: 'Destaque no ranking' },
        { icon: <Heart className="h-4 w-4 text-destructive" />, text: 'Confiança dos clientes' },
      ].map((item) => (
        <div key={item.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.icon}
          <span>{item.text}</span>
        </div>
      ))}
    </div>

    <Button asChild size="lg" className="group relative shadow-lg shadow-accent/10">
      <a href="/cadastro">
        Criar meu perfil gratuito
        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </a>
    </Button>
  </motion.div>
);

export default CoursesCta;
