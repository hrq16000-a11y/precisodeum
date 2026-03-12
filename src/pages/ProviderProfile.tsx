import { useParams } from 'react-router-dom';
import { MapPin, Phone, Globe, MessageCircle, Clock } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { providers } from '@/data/mockData';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProviderProfile = () => {
  const { slug } = useParams();
  const [dbProvider, setDbProvider] = useState<any>(null);
  const [dbServices, setDbServices] = useState<any[]>([]);
  const [dbReviews, setDbReviews] = useState<any[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });

  // Try DB first, fallback to mock
  useEffect(() => {
    const fetchProvider = async () => {
      const { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon), profiles:user_id(full_name, avatar_url)')
        .eq('slug', slug)
        .maybeSingle();
      if (data) {
        setDbProvider(data);
        const { data: svc } = await supabase.from('services').select('*').eq('provider_id', data.id);
        if (svc) setDbServices(svc);
        const { data: rev } = await supabase.from('reviews')
          .select('*, profiles:user_id(full_name)')
          .eq('provider_id', data.id)
          .order('created_at', { ascending: false });
        if (rev) setDbReviews(rev);

        // Load portfolio images
        const { data: files } = await supabase.storage.from('portfolio').list(`${data.user_id}`, { limit: 20 });
        if (files) {
          setPortfolioImages(
            files
              .filter(f => f.name !== '.emptyFolderPlaceholder')
              .map(f => supabase.storage.from('portfolio').getPublicUrl(`${data.user_id}/${f.name}`).data.publicUrl)
          );
        }
      }
    };
    fetchProvider();
  }, [slug]);

  const mockProvider = providers.find((p) => p.slug === slug);
  const provider = dbProvider || mockProvider;

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Profissional não encontrado.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const isDb = !!dbProvider;
  const name = isDb ? ((provider.profiles as any)?.full_name || provider.business_name || 'Profissional') : provider.name;
  const category = isDb ? ((provider.categories as any)?.name || '') : provider.category;
  const services = isDb ? dbServices : (mockProvider?.services || []);
  const reviews = isDb ? dbReviews : (mockProvider?.reviews || []);
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDb) {
      const { error } = await supabase.from('leads').insert({
        provider_id: provider.id,
        client_name: leadForm.name,
        phone: leadForm.phone,
        service_needed: leadForm.service,
        message: leadForm.message,
      });
      if (error) {
        toast.error('Erro ao enviar solicitação');
        return;
      }
    }
    setLeadSent(true);
    toast.success('Solicitação enviada!');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            {/* Profile header */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                  {initials}
                </div>
                <div className="flex-1">
                  <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
                  {(isDb ? provider.business_name : mockProvider?.businessName) && (
                    <p className="text-sm text-muted-foreground">{isDb ? provider.business_name : mockProvider?.businessName}</p>
                  )}
                  <p className="mt-1 text-sm font-medium text-accent">{category}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {provider.neighborhood ? `${provider.neighborhood}, ` : ''}{provider.city} - {provider.state}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {isDb ? provider.years_experience : mockProvider?.yearsExperience} anos de experiência
                    </span>
                  </div>
                  <div className="mt-3">
                    <StarRating
                      rating={isDb ? Number(provider.rating_avg) : mockProvider?.rating || 0}
                      count={isDb ? provider.review_count : mockProvider?.reviewCount}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="accent" size="lg" asChild>
                  <a href={`https://wa.me/${provider.whatsapp}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="lg">
                  <Phone className="h-5 w-5" /> Ligar
                </Button>
              </div>
            </div>

            {/* About */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Sobre o profissional</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{provider.description}</p>
            </div>

            {/* Services */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Serviços oferecidos</h2>
              <div className="mt-4 space-y-3">
                {services.map((s: any) => (
                  <div key={s.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{isDb ? s.service_name : s.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <MapPin className="mr-1 inline h-3 w-3" />{isDb ? s.service_area : s.area}
                        </p>
                      </div>
                      {s.price && <span className="shrink-0 text-sm font-semibold text-accent">{s.price}</span>}
                    </div>
                  </div>
                ))}
                {services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>}
              </div>
            </div>

            {/* Reviews */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Avaliações</h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">
                          {isDb ? ((r.profiles as any)?.full_name || 'Cliente') : r.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(isDb ? r.created_at : r.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="mt-1">
                        <StarRating rating={r.rating} showValue={false} size={12} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-foreground">Solicitar Orçamento</h3>
              {leadSent ? (
                <div className="mt-4 rounded-lg bg-success/10 p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
                  <p className="mt-1 text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
                  <input type="text" placeholder="Seu nome" required value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <input type="tel" placeholder="Seu telefone" required value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Serviço necessário" required value={leadForm.service}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <Button type="submit" variant="accent" className="w-full">Enviar Solicitação</Button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProviderProfile;
