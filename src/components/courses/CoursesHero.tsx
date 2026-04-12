import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Lightbulb, Trophy, Star, Heart, Award } from 'lucide-react';
import heroBanner from '@/assets/courses/hero-banner.jpg';

const floatingIcons = [
  { Icon: BookOpen, x: '8%', y: '25%', delay: 0, size: 20 },
  { Icon: Lightbulb, x: '88%', y: '18%', delay: 0.5, size: 18 },
  { Icon: Trophy, x: '78%', y: '72%', delay: 1, size: 16 },
  { Icon: GraduationCap, x: '12%', y: '78%', delay: 1.5, size: 22 },
  { Icon: Star, x: '92%', y: '50%', delay: 2, size: 14 },
  { Icon: Award, x: '5%', y: '50%', delay: 0.8, size: 16 },
];

const CoursesHero = () => (
  <div className="relative mb-12 overflow-hidden rounded-3xl">
    {/* Background image */}
    <div className="relative h-[320px] md:h-[380px]">
      <img
        src={heroBanner}
        alt="Profissionais celebrando conquistas"
        className="w-full h-full object-cover"
        width={1280}
        height={512}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 to-transparent" />

      {/* Floating icons */}
      {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none text-accent/20"
          style={{ left: x, top: y }}
          animate={{ y: [0, -12, 0], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <Icon size={size} />
        </motion.div>
      ))}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-accent/15 backdrop-blur-md rounded-full px-5 py-2 mb-4 border border-accent/20 shadow-lg shadow-accent/5">
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 2 }}>
              <GraduationCap className="h-4 w-4 text-accent" />
            </motion.div>
            <span className="text-sm font-semibold text-accent tracking-wide">100% Gratuito</span>
            <Heart className="h-3.5 w-3.5 text-accent/60" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-display text-3xl md:text-5xl font-bold text-foreground mb-3 leading-tight drop-shadow-sm"
        >
          Invista no seu{' '}
          <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            Futuro Profissional
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
        >
          Você merece se valorizar. Cursos gratuitos das melhores instituições do Brasil
          para elevar sua carreira e conquistar mais clientes.
        </motion.p>

        {/* Stats pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-2.5 mt-5 flex-wrap"
        >
          {[
            { icon: '🎓', label: 'Com certificado' },
            { icon: '🏆', label: 'Instituições renomadas' },
            { icon: '⚡', label: 'No seu ritmo' },
            { icon: '💪', label: 'Valorize-se' },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ scale: 1.05, y: -2 }}
              className="flex items-center gap-1.5 bg-card/80 backdrop-blur-md border border-border/40 rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow-sm cursor-default"
            >
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </div>
);

export default CoursesHero;
