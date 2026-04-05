import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const InstitutionalPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('institutional_pages')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle()
      .then(({ data }) => {
        setPage(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted mb-4" />
          <div className="h-4 w-full animate-pulse rounded bg-muted mb-2" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-muted-foreground mt-2">Esta página não existe ou não está publicada.</p>
        </div>
        <Footer />
      </div>
    );
  }

  useEffect(() => {
    if (page?.meta_title) document.title = page.meta_title;
    if (page?.meta_description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
      meta.content = page.meta_description;
    }
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-6">{page.title}</h1>
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </main>
      <Footer />
    </div>
  );
};

export default InstitutionalPage;
