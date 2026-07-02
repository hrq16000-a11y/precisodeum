import { Handshake } from 'lucide-react';
import { motion } from 'framer-motion';

const TrustGuarantee = () => (
  <motion.div
    className="mt-4 flex items-center gap-3 rounded-xl border border-accent/10 bg-accent/5 px-4 py-3"
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4 }}
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
      <Handshake className="h-4.5 w-4.5 text-accent" />
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground">Negociação Direta</p>
      <p className="text-xs text-muted-foreground">Sem taxas ocultas. Combine os detalhes do serviço diretamente com o profissional.</p>
    </div>
  </motion.div>
);

export default TrustGuarantee;
