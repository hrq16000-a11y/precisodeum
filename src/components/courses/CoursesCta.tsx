import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

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
      Quer aparecer para mais clientes?
    </h2>
    <p className="relative text-muted-foreground mb-6 max-w-lg mx-auto">
      Complete cursos, adicione certificados ao seu perfil e suba no ranking dos profissionais mais qualificados.
    </p>
    <Button asChild size="lg" className="group relative shadow-lg shadow-accent/10">
      <a href="/cadastro">
        Criar meu perfil gratuito
        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </a>
    </Button>
  </motion.div>
);

export default CoursesCta;
