import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const SignupPage = () => {
  const [accountType, setAccountType] = useState<'client' | 'provider'>('client');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '',
    businessName: '', category: '', city: '', state: '', whatsapp: '', description: '',
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Update profile with phone
    if (data.user) {
      await supabase.from('profiles').update({
        phone: form.phone,
        role: accountType,
      }).eq('id', data.user.id);

      // Create provider profile if provider
      if (accountType === 'provider') {
        const slug = `${form.fullName.toLowerCase().replace(/\s+/g, '-')}-${form.city.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Get category id
        let categoryId = null;
        if (form.category) {
          const { data: cat } = await supabase
            .from('categories')
            .select('id')
            .eq('name', form.category)
            .single();
          categoryId = cat?.id;
        }

        await supabase.from('providers').insert({
          user_id: data.user.id,
          business_name: form.businessName || null,
          description: form.description,
          city: form.city,
          state: form.state,
          phone: form.phone,
          whatsapp: form.whatsapp || form.phone,
          category_id: categoryId,
          slug,
          status: 'pending',
        });
      }
    }

    setLoading(false);
    toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    navigate('/login');
  };

  const handleGoogleSignup = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error('Erro ao cadastrar com Google');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-8 shadow-card">
            <h1 className="text-center font-display text-2xl font-bold text-foreground">Criar Conta</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Junte-se à plataforma</p>

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

            <Button variant="outline" className="mt-4 w-full" onClick={handleGoogleSignup}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Cadastrar com Google
            </Button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Nome completo</label>
                <input type="text" name="fullName" required value={form.fullName} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
                <input type="email" name="email" required value={form.email} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Telefone</label>
                <input type="tel" name="phone" required value={form.phone} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
                <input type="password" name="password" required minLength={6} value={form.password} onChange={handleChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </div>

              {accountType === 'provider' && (
                <>
                  <hr className="border-border" />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Nome do negócio</label>
                    <input type="text" name="businessName" value={form.businessName} onChange={handleChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Categoria principal</label>
                    <select name="category" value={form.category} onChange={handleChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                      <option value="">Selecione...</option>
                      <option>Eletricista</option>
                      <option>Encanador</option>
                      <option>Pedreiro</option>
                      <option>Técnico em Informática</option>
                      <option>Ar-condicionado</option>
                      <option>Marido de Aluguel</option>
                      <option>Antenista</option>
                      <option>Instalador de Câmeras</option>
                      <option>Instalador de TV</option>
                      <option>Mudanças</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Cidade</label>
                      <input type="text" name="city" required value={form.city} onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
                      <input type="text" name="state" required value={form.state} onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">WhatsApp</label>
                    <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Descrição profissional</label>
                    <textarea name="description" rows={3} value={form.description} onChange={handleChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                </>
              )}

              <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                {loading ? 'Criando...' : accountType === 'provider' ? 'Criar Conta de Profissional' : 'Criar Conta'}
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
