import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, MessageCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink } from '@/lib/whatsapp';

interface Props {
  providers: DbProvider[];
  isLoading: boolean;
}

const FeaturedProviders = ({ providers, isLoading }: Props) => {
  return (
    <section className="bg-muted/50 py-8">
      <div className="container">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
              Profissionais em Destaque
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Os mais bem avaliados da plataforma</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden text-primary md:flex" asChild>
            <Link to="/buscar">Ver todos <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-64 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum profissional em destaque ainda.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible">
            {providers.map((p) => {
              const displayName = p.name || p.businessName || p.category || 'Profissional';
              const displayPhoto = p.photo || p.serviceImage || '';

              return (
                <div
                  key={p.id}
                  className="group flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 md:w-auto"
                >
                  <div className="flex flex-1 flex-col p-3.5">
                    <div className="flex gap-3">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={displayPhoto || undefined} alt={displayName} />
                        <AvatarFallback className="bg-primary/10 text-xl">
                          {p.categoryIcon || '🔧'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link to={`/profissional/${p.slug}`} className="block">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="truncate font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {displayName}
                            </h3>
                            <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-label="Destaque" />
                          </div>
                        </Link>
                        {p.category && (
                          <p className="mt-0.5 text-xs font-medium text-accent">{p.category}</p>
                        )}
                        {(p.city || p.state) && (
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {[p.city, p.state].filter(Boolean).join(' - ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1" />

                    <div className="mt-3 flex gap-2">
                      {p.whatsapp && (
                        <Button variant="accent" size="sm" className="flex-1 h-8 text-xs" asChild>
                          <a href={whatsappLink(p.whatsapp, `Olá! Vi seu perfil "${displayName}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className={`h-8 text-xs ${p.whatsapp ? '' : 'flex-1'}`} asChild>
                        <Link to={`/profissional/${p.slug}`}>Ver Perfil</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-center md:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link to="/buscar">Ver todos os profissionais</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProviders;
