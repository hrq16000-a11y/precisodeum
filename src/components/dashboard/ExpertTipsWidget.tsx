import { useState, useEffect } from 'react';
import { Lightbulb, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getExpertTips } from '@/lib/expertTips';

/**
 * Widget de Dicas de Especialista — muda conforme a categoria do prestador.
 * Fica visível por padrão; pode ser dispensado pelo wrapper DismissibleWidget.
 */
const ExpertTipsWidget = () => {
  const { user } = useAuth();
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const tips = getExpertTips(categoryName);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('providers')
        .select('category_id, categories:category_id(name, slug)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      const cat = (data as any)?.categories;
      if (cat) setCategoryName(cat.slug || cat.name || null);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const next = () => setTipIndex((i) => (i + 1) % tips.length);

  return (
    <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/15 p-2 shrink-0">
          <Lightbulb className="h-4 w-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">
            Dica de especialista
            {categoryName && (
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                · {categoryName}
              </span>
            )}
          </h3>
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mt-1 text-xs leading-relaxed text-muted-foreground"
            >
              {tips[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        {tips.length > 1 && (
          <button
            onClick={next}
            aria-label="Próxima dica"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ExpertTipsWidget;
