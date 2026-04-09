import { motion, useScroll, useSpring } from 'framer-motion';

const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[61] h-[3px] origin-left bg-gradient-to-r from-accent via-primary to-secondary"
      style={{ scaleX }}
    />
  );
};

export default ScrollProgressBar;
