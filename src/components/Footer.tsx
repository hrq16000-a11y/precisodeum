import { Link } from 'react-router-dom';

const Footer = () => (
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
            <li><Link to="/categoria/eletricista" className="hover:text-primary-foreground">Eletricista</Link></li>
            <li><Link to="/categoria/encanador" className="hover:text-primary-foreground">Encanador</Link></li>
            <li><Link to="/categoria/pedreiro" className="hover:text-primary-foreground">Pedreiro</Link></li>
            <li><Link to="/categoria/tecnico-informatica" className="hover:text-primary-foreground">Técnico em Informática</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Plataforma</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><Link to="/cadastro" className="hover:text-primary-foreground">Cadastre-se</Link></li>
            <li><Link to="/login" className="hover:text-primary-foreground">Login</Link></li>
            <li><Link to="/buscar" className="hover:text-primary-foreground">Buscar</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Contato</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li>contato@precisodeum.com.br</li>
            <li>(41) 3000-0000</li>
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t border-primary-foreground/10 pt-6 text-center text-xs text-primary-foreground/40">
        © 2026 Preciso de um. Todos os direitos reservados.
      </div>
    </div>
  </footer>
);

export default Footer;
