import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  variant?: 'hero' | 'compact';
}

const SearchBar = ({ variant = 'hero' }: SearchBarProps) => {
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (service) params.set('q', service);
    if (location) params.set('cidade', location);
    navigate(`/buscar?${params.toString()}`);
  };

  if (variant === 'compact') {
    return (
      <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5">
        <div className="flex flex-1 items-center gap-2 px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Preciso de um..."
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <Button type="submit" variant="accent" size="sm">Buscar</Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl">
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-card-hover sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-2">
        <div className="flex flex-1 items-center gap-2 px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Preciso de um..."
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div className="flex flex-1 items-center gap-2 px-4">
          <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cidade ou CEP"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <Button type="submit" variant="hero" size="lg" className="rounded-full sm:rounded-full">
          Buscar
        </Button>
      </div>
    </form>
  );
};

export default SearchBar;
