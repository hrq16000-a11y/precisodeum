import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.6, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={scrollToTop}
          className="fixed right-3 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground backdrop-blur-sm transition-opacity hover:opacity-100"
          style={{ top: '60vh' }}
          aria-label="Voltar ao topo"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.85 }}
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default BackToTopButton;
