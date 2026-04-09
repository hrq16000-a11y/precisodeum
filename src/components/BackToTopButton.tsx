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
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/25 transition-colors hover:bg-accent/90 md:bottom-6 md:right-6 md:h-11 md:w-11"
          aria-label="Voltar ao topo"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowUp className="h-4 w-4 md:h-5 md:w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default BackToTopButton;
