import { useParams } from 'react-router-dom';
import { MapPin, Phone, Globe, MessageCircle, Clock, Briefcase } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { providers } from '@/data/mockData';
import { useState } from 'react';

const ProviderProfile = () => {
  const { slug } = useParams();
  const provider = providers.find((p) => p.slug === slug);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });

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

  const initials = provider.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1">
            {/* Profile header */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                  {initials}
                </div>
                <div className="flex-1">
                  <h1 className="font-display text-2xl font-bold text-foreground">{provider.name}</h1>
                  {provider.businessName && <p className="text-sm text-muted-foreground">{provider.businessName}</p>}
                  <p className="mt-1 text-sm font-medium text-accent">{provider.category}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{provider.neighborhood}, {provider.city} - {provider.state}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{provider.yearsExperience} anos de experiência</span>
                  </div>
                  <div className="mt-3">
                    <StarRating rating={provider.rating} count={provider.reviewCount} />
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
                {provider.services.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{s.area}</p>
                      </div>
                      {s.price && <span className="shrink-0 text-sm font-semibold text-accent">{s.price}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Avaliações</h2>
              {provider.reviews.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {provider.reviews.map((r) => (
                    <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{r.userName}</span>
                        <span className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString('pt-BR')}</span>
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

          {/* Sidebar - Contact form */}
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
                  <input
                    type="text"
                    placeholder="Seu nome"
                    required
                    value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="tel"
                    placeholder="Seu telefone"
                    required
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Serviço necessário"
                    required
                    value={leadForm.service}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <textarea
                    placeholder="Descreva o que precisa..."
                    rows={3}
                    value={leadForm.message}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
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
