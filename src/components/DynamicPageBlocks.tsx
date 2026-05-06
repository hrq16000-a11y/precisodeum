import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DynamicPageBlocksProps {
  pageSlug: string;
  city?: string;
  category?: string;
  campaign?: string;
}

const DynamicPageBlocks = ({ pageSlug, city, category, campaign }: DynamicPageBlocksProps) => {
  const [blocks, setBlocks] = useState<any[]>([]);

  useEffect(() => {
    const fetchBlocks = async () => {
      const now = new Date().toISOString();
      let query = supabase
        .from('page_blocks')
        .select('*')
        .eq('page_slug', pageSlug)
        .eq('active', true)
        .order('display_order');

      const { data } = await query;
      if (!data) return;

      // Client-side filtering for dates and targeting
      const filtered = data.filter(block => {
        if (block.start_date && block.start_date > now) return false;
        if (block.end_date && block.end_date < now) return false;
        if (block.target_city && city && block.target_city.toLowerCase() !== city.toLowerCase()) return false;
        if (block.target_category && category && block.target_category.toLowerCase() !== category.toLowerCase()) return false;
        if (block.target_campaign && campaign && block.target_campaign.toLowerCase() !== campaign.toLowerCase()) return false;
        return true;
      });

      setBlocks(filtered);
    };

    fetchBlocks();
  }, [pageSlug, city, category, campaign]);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-6">
      {blocks.map(block => (
        <DynamicBlock key={block.id} block={block} />
      ))}
    </div>
  );
};

const DynamicBlock = ({ block }: { block: any }) => {
  const content = block.content || {};

  switch (block.block_type) {
    case 'text':
      return (
        <section className="container mx-auto px-4">
          {block.title && <h2 className="text-2xl font-bold text-foreground mb-2">{block.title}</h2>}
          {block.subtitle && <p className="text-muted-foreground mb-4">{block.subtitle}</p>}
          {content.body && (
            <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: content.body }} />
          )}
        </section>
      );

    case 'banner':
      return (
        <section className="relative overflow-hidden rounded-lg mx-4" style={{ minHeight: content.height || '200px' }}>
          {content.image_url && (
            <img src={content.image_url} alt={block.title} className="w-full h-full object-cover absolute inset-0" />
          )}
          <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: content.overlay ? `rgba(0,0,0,${content.overlay_opacity || 0.5})` : undefined }}>
            {block.title && <h2 className="text-2xl font-bold text-white mb-2">{block.title}</h2>}
            {block.subtitle && <p className="text-white/80">{block.subtitle}</p>}
            {content.cta_text && content.cta_link && (
              <a href={content.cta_link} className="mt-4 inline-block rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
                {content.cta_text}
              </a>
            )}
          </div>
        </section>
      );

    case 'cta':
      return (
        <section className="container mx-auto px-4 text-center py-8 bg-muted/30 rounded-lg">
          {block.title && <h2 className="text-2xl font-bold text-foreground mb-2">{block.title}</h2>}
          {block.subtitle && <p className="text-muted-foreground mb-4">{block.subtitle}</p>}
          {content.button_text && content.button_link && (
            <a href={content.button_link} className="inline-block rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground">
              {content.button_text}
            </a>
          )}
        </section>
      );

    case 'html':
      return (
        <section className="container mx-auto px-4">
          <div dangerouslySetInnerHTML={{ __html: content.html || '' }} />
        </section>
      );

    case 'cards':
      return (
        <section className="container mx-auto px-4">
          {block.title && <h2 className="text-2xl font-bold text-foreground mb-4">{block.title}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(content.items || []).map((item: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                {item.icon && <span className="text-2xl mb-2 block">{item.icon}</span>}
                {item.title && <h3 className="font-semibold text-foreground">{item.title}</h3>}
                {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
              </div>
            ))}
          </div>
        </section>
      );

    case 'image':
      return (
        <section className="container mx-auto px-4">
          {content.image_url && (
            <img src={content.image_url} alt={block.title || ''} className="w-full rounded-lg object-cover" style={{ maxHeight: content.max_height || '400px' }} />
          )}
          {block.title && <p className="text-sm text-muted-foreground mt-2 text-center">{block.title}</p>}
        </section>
      );

    default:
      return (
        <section className="container mx-auto px-4 py-4 bg-muted/20 rounded-lg">
          <p className="text-xs text-muted-foreground">Bloco: {block.block_type} — {block.title}</p>
        </section>
      );
  }
};

export default DynamicPageBlocks;
