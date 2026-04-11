import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { whatsappLink } from '@/lib/whatsapp';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Search, HelpCircle, Users, Briefcase, CreditCard, Shield, MessageCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FALLBACK_PHONE = '5541997452053';

const SECTIONS = [
  { key: 'clientes', label: 'Para Clientes', icon: Users, description: 'Como buscar profissionais, avaliar e solicitar orçamentos' },
  { key: 'profissionais', label: 'Para Profissionais', icon: Briefcase, description: 'Cadastro, perfil, serviços e leads' },
  { key: 'planos', label: 'Planos e Pagamentos', icon: CreditCard, description: 'Planos, assinaturas e cobranças' },
  { key: 'conta', label: 'Conta e Segurança', icon: Shield, description: 'Login, senha, privacidade e dados' },
];

const HelpCenterPage = () => {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const supportPhone = useSettingValue('whatsapp_support_phone') || FALLBACK_PHONE;

  useSeoHead({
    title: 'Central de Ajuda | Preciso de um',
    description: 'Tire suas dúvidas sobre o Preciso de um. Encontre respostas para perguntas frequentes sobre cadastro, serviços, planos e mais.',
    canonical: `${SITE_BASE_URL}/ajuda`,
  });

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['help-center-faqs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('faqs')
        .select('*')
        .eq('active', true)
        .order('display_order');
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return faqs;
    const q = search.toLowerCase();
    return faqs.filter((f: any) =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [search, faqs]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent/10 via-background to-primary/5 py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15">
              <HelpCircle className="h-8 w-8 text-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Central de Ajuda
            </h1>
            <p className="mt-3 text-muted-foreground">
              Encontre respostas rápidas para suas dúvidas
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            className="relative mt-8 mx-auto max-w-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por palavra-chave..."
              className="w-full rounded-2xl border border-border bg-card pl-12 pr-4 py-4 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </motion.div>
        </div>
      </section>

      {/* Category cards */}
      {!search.trim() && (
        <section className="container mx-auto max-w-4xl px-4 -mt-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SECTIONS.map((sec, i) => (
              <motion.a
                key={sec.key}
                href={`#${sec.key}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <sec.icon className="h-5 w-5 text-accent" />
                </div>
                <span className="text-xs font-semibold text-foreground">{sec.label}</span>
              </motion.a>
            ))}
          </div>
        </section>
      )}

      {/* FAQ list */}
      <section className="container mx-auto max-w-3xl px-4 pb-16">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-muted-foreground">Nenhuma pergunta encontrada.</p>
            <p className="mt-1 text-sm text-muted-foreground">Tente outra busca ou fale com nosso suporte.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((faq: any, i: number) => {
              const isOpen = openId === faq.id;
              return (
                <motion.div
                  key={faq.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{faq.question}</span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Support CTA */}
        <motion.div
          className="mt-12 rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-lg font-bold text-foreground">Ainda tem dúvidas?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nossa equipe está pronta para ajudar</p>
          <a
            href={whatsappLink(supportPhone, 'Olá! Preciso de ajuda no Preciso de um.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-md hover:brightness-110 transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com Suporte
          </a>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default HelpCenterPage;
