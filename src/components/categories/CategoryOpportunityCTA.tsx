import { Link } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { Rocket, Star, Megaphone, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryIcon from '@/components/CategoryIcon';

interface Props {
  categoryName: string;
  categorySlug?: string;
  icon?: string;
  city?: string | null;
}

/**
 * Bloco de incentivo exibido em categorias que ainda não possuem prestadores.
 * Converte a página "vazia" em uma oportunidade: cadastro de profissional,
 * patrocínio da categoria e caminhos alternativos de navegação.
 */
const CategoryOpportunityCTA = ({ categoryName, categorySlug, icon, city }: Props) => {
  const local = city ? ` em ${city}` : '';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="my-8 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-6 md:p-10"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <CategoryIcon icon={icon || 'Sparkles'} size={30} className="text-primary" />
        </span>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
          <Rocket className="h-3.5 w-3.5" /> Categoria aberta
        </span>

        <h2 className="mt-3 font-display text-xl font-bold text-foreground md:text-2xl">
          Ainda não há profissionais de {categoryName}{local}
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Quem chega primeiro aparece primeiro. Cadastre seu serviço agora e receba os
          contatos de quem procurar por {categoryName.toLowerCase()} na sua região — é
          100% gratuito para profissionais.
        </p>

        <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 text-left">
            <div className="flex items-center gap-2 text-primary">
              <Star className="h-4 w-4" />
              <span className="text-sm font-bold text-foreground">Sou profissional</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Perfil completo, página própria e leads diretos no WhatsApp.
            </p>
            <Button asChild size="sm" className="mt-3 w-full gap-1.5">
              <Link to={`/cadastro-inicial?categoria=${categorySlug || ''}`}>
                Cadastrar meu serviço <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 text-left">
            <div className="flex items-center gap-2 text-accent">
              <Megaphone className="h-4 w-4" />
              <span className="text-sm font-bold text-foreground">Sou empresa</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Patrocine esta categoria e seja o destaque exclusivo da página.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full gap-1.5">
              <Link to="/quero-ser-patrocinador">
                Quero patrocinar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/categorias">
              <Search className="h-3.5 w-3.5" /> Ver outras categorias
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/buscar">Buscar profissionais</Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default CategoryOpportunityCTA;
