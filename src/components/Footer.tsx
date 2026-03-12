import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Footer = () => {
  const { data: topCities = [] } = useQuery({
    queryKey: ['footer-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('name, slug').order('name').limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['footer-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name, slug').order('name').limit(8);
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-3 font-display text-lg font-bold">Preciso de um</h3>
            <p className="text-sm text-primary-foreground/70">
              Encontre profissionais confiáveis perto de você. A maior plataforma de serviços do Brasil.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Categorias</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link to={`/categoria/${cat.slug}`} className="hover:text-primary-foreground">{cat.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Cidades</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              {topCities.map((city) => (
                <li key={city.slug}>
                  <Link to={`/cidade/${city.slug}`} className="hover:text-primary-foreground">{city.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Plataforma</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/cadastro" className="hover:text-primary-foreground">Cadastre-se</Link></li>
              <li><Link to="/login" className="hover:text-primary-foreground">Login</Link></li>
              <li><Link to="/buscar" className="hover:text-primary-foreground">Buscar</Link></li>
            </ul>
            <h4 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Contato</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>contato@precisodeum.com.br</li>
              <li>(41) 3000-0000</li>
            </ul>
          </div>
        </div>

        {/* SEO Links Grid */}
        <div className="mt-8 border-t border-primary-foreground/10 pt-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">Buscas populares</h4>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 5).flatMap((cat) =>
              topCities.slice(0, 4).map((city) => (
                <Link
                  key={`${cat.slug}-${city.slug}`}
                  to={`/${cat.slug}-${city.slug}`}
                  className="text-xs text-primary-foreground/40 hover:text-primary-foreground/70"
                >
                  {cat.name} em {city.name}
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-primary-foreground/10 pt-6 text-center text-xs text-primary-foreground/40">
          © 2026 Preciso de um. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
