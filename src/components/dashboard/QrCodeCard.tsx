import { useState } from 'react';
import { QrCode, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

const SITE_BASE = 'https://precisodeum.lovable.app';

const QrCodeCard = () => {
  const { provider } = useAuth();
  const [show, setShow] = useState(false);

  if (!provider?.slug) return null;

  const profileUrl = `${SITE_BASE}/profissional/${provider.slug}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=000000&margin=10`;

  const handleDownload = async () => {
    try {
      const res = await fetch(qrApiUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${provider.slug}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(qrApiUrl, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <QrCode className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">QR Code do Perfil</h3>
            <p className="text-[10px] text-muted-foreground">Imprima e compartilhe com clientes</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShow(!show)} className="text-xs">
          {show ? 'Ocultar' : 'Gerar QR'}
        </Button>
      </div>

      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-col items-center gap-3 pt-2"
        >
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <img src={qrApiUrl} alt="QR Code" className="w-40 h-40" loading="lazy" />
          </div>
          <p className="text-[10px] text-muted-foreground text-center max-w-[200px] truncate">{profileUrl}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="text-xs gap-1">
              <Download className="h-3 w-3" /> Baixar PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(profileUrl, '_blank')} className="text-xs gap-1">
              <ExternalLink className="h-3 w-3" /> Ver Perfil
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default QrCodeCard;
