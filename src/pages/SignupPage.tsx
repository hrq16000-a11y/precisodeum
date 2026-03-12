import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const SignupPage = () => {
  const [accountType, setAccountType] = useState<'client' | 'provider'>('client');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h1 className="text-center font-display text-2xl font-bold text-foreground">Criar Conta</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Junte-se à plataforma</p>

            {/* Account type toggle */}
            <div className="mt-6 flex rounded-lg bg-muted p-1">
              <button
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${accountType === 'client' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAccountType('client')}
              >
                Cliente
              </button>
              <button
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${accountType === 'provider' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAccountType('provider')}
              >
                Profissional
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nome completo</label>
                <input type="text" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
                <input type="email" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Telefone</label>
                <input type="tel" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
                <input type="password" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>

              {accountType === 'provider' && (
                <>
                  <hr className="border-border" />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Nome do negócio</label>
                    <input type="text" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Categoria principal</label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                      <option value="">Selecione...</option>
                      <option>Eletricista</option>
                      <option>Encanador</option>
                      <option>Pedreiro</option>
                      <option>Técnico em Informática</option>
                      <option>Ar-condicionado</option>
                      <option>Marido de Aluguel</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Cidade</label>
                      <input type="text" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
                      <input type="text" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
                    <input type="tel" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Descrição profissional</label>
                    <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                </>
              )}

              <Button type="submit" variant="accent" className="w-full">
                {accountType === 'provider' ? 'Criar Conta de Profissional' : 'Criar Conta'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta? <Link to="/login" className="font-medium text-accent hover:underline">Entrar</Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignupPage;
