import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Lightbulb, Trophy, Star, Heart, Award, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    {/* Full gradient background */}
    <div className="relative min-h-[340px] md:min-h-[420px] bg-gradient-to-br from-primary via-primary to-primary/90">
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      {/* Gradient orbs */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent 70%)', top: '-15%', right: '-5%' }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent)), transparent 70%)', bottom: '-10%', left: '-5%' }}
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating icons */}
      {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none text-white/10"
          style={{ left: x, top: y }}
          animate={{ y: [0, -12, 0], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <Icon size={size} />
        </motion.div>
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-5 bg-white/10 backdrop-blur-md text-primary-foreground text-sm px-5 py-2 border border-white/20 shadow-lg">
            <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 2 }}>
              <GraduationCap className="h-4 w-4 mr-2 inline text-amber-300" />
            </motion.span>
            100% Gratuito — Invista em você!
          </Badge>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground mb-4 leading-tight"
        >
          Invista no seu{' '}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
              Futuro Profissional
            </span>
            <motion.span
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-primary-foreground/60 max-w-2xl mx-auto text-sm md:text-lg leading-relaxed mb-6"
        >
          Cursos gratuitos das melhores instituições do Brasil para elevar sua carreira e conquistar mais clientes.
        </motion.p>

        {/* Stats pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-3 flex-wrap"
        >
          {[
            { icon: Award, label: 'Com certificado', color: 'text-amber-300' },
            { icon: BookOpen, label: 'SEBRAE, SENAI, FGV', color: 'text-amber-300/80' },
            { icon: Sparkles, label: 'No seu ritmo', color: 'text-amber-300/80' },
            { icon: TrendingUp, label: 'Mais clientes', color: 'text-amber-300/80' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className="flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-xs text-primary-foreground/70 shadow-sm cursor-default"
            >
              <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              <span className="font-medium">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  </div>
);

export default CoursesHero;
