import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h1 className="text-center font-display text-2xl font-bold text-foreground">Entrar</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Acesse sua conta</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <Button type="submit" variant="accent" className="w-full">Entrar</Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Não tem conta? <Link to="/cadastro" className="font-medium text-accent hover:underline">Cadastre-se</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage;
