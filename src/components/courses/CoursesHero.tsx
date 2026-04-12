import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Lightbulb, Trophy } from 'lucide-react';

const floatingIcons = [
  { Icon: BookOpen, x: '10%', y: '20%', delay: 0, size: 20 },
  { Icon: Lightbulb, x: '85%', y: '15%', delay: 0.5, size: 18 },
  { Icon: Trophy, x: '75%', y: '75%', delay: 1, size: 16 },
  { Icon: GraduationCap, x: '15%', y: '80%', delay: 1.5, size: 22 },
];

const CoursesHero = () => (
  <div className="relative text-center mb-12 py-6 overflow-hidden">
    {/* Background orbs */}
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-accent/[0.04] blur-3xl pointer-events-none"
      animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute top-0 right-[15%] w-[200px] h-[200px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none"
      animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
    />

    {/* Floating icons */}
    {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
      <motion.div
        key={i}
        className="absolute pointer-events-none text-accent/10"
        style={{ left: x, top: y }}
        animate={{ y: [0, -12, 0], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <Icon size={size} />
      </motion.div>
    ))}

    {/* Badge */}
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="inline-flex items-center gap-2 bg-accent/10 backdrop-blur-sm rounded-full px-5 py-2 mb-5 border border-accent/10">
        <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 2 }}>
          <GraduationCap className="h-4 w-4 text-accent" />
        </motion.div>
        <span className="text-sm font-semibold text-accent tracking-wide">100% Gratuito</span>
      </div>
    </motion.div>

    {/* Title */}
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className="relative font-display text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight"
    >
      Portal de Cursos{' '}
      <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
        Gratuitos
      </span>
    </motion.h1>

    {/* Subtitle */}
    <motion.p
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative text-muted-foreground max-w-2xl mx-auto text-base md:text-lg leading-relaxed"
    >
      Capacite-se gratuitamente com cursos das melhores instituições do Brasil.
      <br className="hidden sm:block" />
      Valorize seu perfil profissional e conquiste mais clientes.
    </motion.p>

    {/* Stats pills */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative flex items-center justify-center gap-3 mt-6 flex-wrap"
    >
      {[
        { icon: '🎓', label: 'Cursos com certificado' },
        { icon: '🏆', label: 'Instituições renomadas' },
        { icon: '⚡', label: 'Aprenda no seu ritmo' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground shadow-sm">
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </motion.div>
  </div>
);

export default CoursesHero;
