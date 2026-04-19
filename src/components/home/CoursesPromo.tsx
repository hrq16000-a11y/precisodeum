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
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-20 px-4">
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
              <div className="animate-fade-in">
                <Badge className="mb-4 bg-white/10 text-primary-foreground border border-white/20 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 mr-1" /> Portal de Capacitação
                </Badge>
              </div>

              <h2 className="text-2xl md:text-4xl font-extrabold text-primary-foreground leading-tight mb-4 animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                Invista no seu{' '}
                <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                  futuro profissional
                </span>
              </h2>

              <p className="text-primary-foreground/70 text-sm md:text-base leading-relaxed mb-6 max-w-md animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                Cursos gratuitos das melhores instituições do Brasil. Conquiste certificados,
                aprimore suas habilidades e atraia mais clientes.
              </p>

              <div className="animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground shadow-xl shadow-secondary/30 hover:shadow-2xl group"
                  onClick={() => navigate('/cursos')}
                >
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Ver Cursos Gratuitos
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Right — cards grid */}
            <div className="grid grid-cols-2 gap-3">
              {highlights.map((item, i) => (
                <div
                  key={item.label}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all duration-300 group cursor-default animate-fade-in"
                  style={{ animationDelay: `${200 + i * 100}ms`, animationFillMode: 'both' }}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-105">
                    <item.icon className="w-5 h-5 text-amber-300" />
                  </div>
                  <h3 className="text-sm font-bold text-primary-foreground mb-0.5">{item.label}</h3>
                  <p className="text-[11px] text-primary-foreground/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust bar */}
          <div className="relative flex items-center justify-center gap-6 mt-8 pt-6 border-t border-white/10 flex-wrap animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <Heart className="w-3 h-3" /> Valorize sua carreira
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <Award className="w-3 h-3" /> Certificados reconhecidos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary-foreground/50">
              <TrendingUp className="w-3 h-3" /> Destaque na plataforma
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoursesPromo;
