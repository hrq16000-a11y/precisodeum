import { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Copy, Check, ExternalLink, Star, MapPin, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

const SITE_BASE = 'https://precisodeum.lovable.app';

const ShareProfileCard = () => {
  const { profile, provider } = useAuth();
  const { levelName, levelColor } = usePermissions();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!provider?.slug) return null;

  const profileUrl = `${SITE_BASE}/profissional/${provider.slug}`;
  const rating = provider?.rating_avg ? Number(provider.rating_avg).toFixed(1) : null;
  const name = profile?.full_name || 'Profissional';
  const city = provider?.city || '';
  const state = provider?.state || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const shareMessage = `Olá! Veja meu perfil profissional e serviços no portal Preciso de um Profissional: ${profileUrl}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} — Perfil Profissional`,
          text: shareMessage,
          url: profileUrl,
        });
        return;
      } catch { /* user cancelled or unsupported */ }
    }
    // Fallback: WhatsApp link
    const wa = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsApp = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all"
      >
        <Share2 className="h-4 w-4" />
        Compartilhar meu Perfil Profissional
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {/* Visual card preview */}
          <div className="bg-gradient-to-br from-accent/10 via-primary/5 to-background p-6 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
            <div className="relative text-center">
              {/* Avatar */}
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={name} className="h-20 w-20 rounded-2xl object-cover mx-auto border-3 border-card shadow-lg" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto text-2xl font-bold text-accent border-3 border-card shadow-lg">
                  {name[0]?.toUpperCase()}
                </div>
              )}

              <h2 className="mt-3 text-lg font-bold text-foreground">{name}</h2>

              {city && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {city}{state ? `, ${state}` : ''}
                </p>
              )}

              {/* Level badge */}
              {levelName && (
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold mt-3 shadow-sm"
                  style={{ backgroundColor: `${levelColor}20`, color: levelColor, border: `1px solid ${levelColor}30` }}
                >
                  {levelName}
                </motion.span>
              )}

              {/* Rating */}
              {rating && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-bold text-foreground">{rating}</span>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground mt-3">precisodeum.lovable.app</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2">
            <Button onClick={handleWhatsApp} className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
              <MessageCircle className="h-4 w-4" />
              Enviar pelo WhatsApp
            </Button>
            <Button onClick={handleNativeShare} className="w-full gap-2" variant="accent">
              <Share2 className="h-4 w-4" />
              Mais opções de compartilhamento
            </Button>
            <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors py-2"
            >
              <ExternalLink className="h-3 w-3" />
              Ver minha página pública
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareProfileCard;
