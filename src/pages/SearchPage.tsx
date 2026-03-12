import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SearchBar from '@/components/SearchBar';
import ProviderCard from '@/components/ProviderCard';
import { providers, categories } from '@/data/mockData';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const city = searchParams.get('cidade') || '';
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minRating, setMinRating] = useState(0);

  const filtered = providers.filter((p) => {
    const matchesQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase());
    const matchesCity = !city || p.city.toLowerCase().includes(city.toLowerCase());
    const matchesCategory = !selectedCategory || p.categorySlug === selectedCategory;
    const matchesRating = p.rating >= minRating;
    return matchesQuery && matchesCity && matchesCategory && matchesRating;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-6">
        <div className="mb-6">
          <SearchBar variant="compact" />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Filters sidebar */}
          <aside className="w-full shrink-0 lg:w-60">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              <h3 className="mb-3 text-sm font-bold text-foreground">Filtros</h3>

              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Avaliação mínima</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                >
                  <option value={0}>Todas</option>
                  <option value={4}>4+ estrelas</option>
                  <option value={4.5}>4.5+ estrelas</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            <p className="mb-4 text-sm text-muted-foreground">
              {filtered.length} profissional(is) encontrado(s)
              {query && <> para "<span className="font-semibold text-foreground">{query}</span>"</>}
              {city && <> em <span className="font-semibold text-foreground">{city}</span></>}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <p className="text-lg font-semibold text-foreground">Nenhum profissional encontrado</p>
                <p className="mt-2 text-sm text-muted-foreground">Tente alterar os filtros ou buscar por outro termo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SearchPage;
