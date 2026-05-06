import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, MessageCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink } from '@/lib/whatsapp';
import FadeInSection from '@/components/FadeInSection';

interface Props {
  providers: DbProvider[];
  isLoading: boolean;
}

const FeaturedProviders = ({ providers, isLoading }: Props) => {
  const featuredList = providers;

  return (
    <section className="bg-muted/50 py-12">
      <div className="container">
        <FadeInSection className="mb-8 flex items-end justify-between">
          <div>
            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-2">
              ⭐ Destaque
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Profissionais em Destaque
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Os mais bem avaliados da plataforma</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden text-primary md:flex" asChild>
            <Link to="/buscar">Ver todos <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </FadeInSection>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : featuredList.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum profissional em destaque ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredList.map((p, i) => {
              const displayName = p.name || p.businessName || p.category || 'Profissional';
              const displayPhoto = p.photo || p.serviceImage || '';

              return (
                <FadeInSection key={p.id} delay={i * 0.1}>
                  <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1">
                    {/* Accent top border */}
                    <div className="h-1 bg-gradient-to-r from-accent via-secondary to-accent" />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex gap-4">
                        <Avatar className="h-14 w-14 shrink-0 ring-2 ring-accent/20">
                          <AvatarImage src={displayPhoto || undefined} alt={displayName} />
                          <AvatarFallback className="bg-primary/10 text-2xl">
                            {p.categoryIcon || '🔧'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Link to={`/profissional/${p.slug}`} className="block">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                {displayName}
                              </h3>
                              <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent animate-pulse" aria-label="Destaque" />
                            </div>
                          </Link>
                          {p.category && (
                            <p className="mt-0.5 text-sm font-medium text-accent">{p.category}</p>
                          )}
                          {(p.city || p.state) && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {[p.city, p.state].filter(Boolean).join(' - ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1" />

                      <div className="mt-4 flex gap-2">
                        {p.whatsapp && (
                          <Button variant="accent" size="sm" className="flex-1" asChild>
                            <a href={whatsappLink(p.whatsapp, `Olá! Vi seu perfil "${displayName}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4" /> WhatsApp
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className={p.whatsapp ? '' : 'flex-1'} asChild>
                          <Link to={`/profissional/${p.slug}`}>Ver Perfil</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        )}

        <FadeInSection delay={0.3} className="mt-6 text-center md:hidden">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/buscar">Ver todos os profissionais</Link>
          </Button>
        </FadeInSection>
      </div>
    </section>
  );
};

export default FeaturedProviders;
