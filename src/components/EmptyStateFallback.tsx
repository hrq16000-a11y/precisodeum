import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, Briefcase, UserPlus, Newspaper } from 'lucide-react';

interface Props {
  title?: string;
  message?: string;
}

const EmptyStateFallback = ({
  title = 'Nenhum conteúdo encontrado',
  message = 'Não encontramos resultados para esta busca.',
}: Props) => (
  <div className="rounded-xl border border-border bg-card p-8 text-center shadow-card">
    <p className="text-lg font-semibold text-foreground">{title}</p>
    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Button size="sm" asChild>
        <Link to="/cadastro">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Cadastre seu serviço
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/vagas">
          <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Ver vagas
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/blog">
          <Newspaper className="mr-1.5 h-3.5 w-3.5" /> Notícias
        </Link>
      </Button>
    </div>
  </div>
);

export default EmptyStateFallback;
