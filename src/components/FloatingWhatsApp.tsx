import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';
import { useLocation } from 'react-router-dom';
import { useSettingValue } from '@/hooks/useSiteSettings';

interface Props {
  jobTitle?: string;
}

const FALLBACK_PHONE = '5541997452053';

const FloatingWhatsApp = ({ jobTitle }: Props) => {
  const supportPhone = useSettingValue('whatsapp_support_phone') || FALLBACK_PHONE;
  const message = jobTitle
    ? `Olá! Vi a vaga "${jobTitle}" no Preciso de um e gostaria de mais informações.`
    : 'Olá! Preciso de ajuda no Preciso de um.';
  const url = whatsappLink(supportPhone, message);

  const location = useLocation();
  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];
  const hasBottomNav = !hiddenPaths.some(p => location.pathname.startsWith(p));

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      style={{
        zIndex: 9999,
        bottom: hasBottomNav
          ? 'calc(env(safe-area-inset-bottom, 0px) + 90px)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}
      aria-label="Falar pelo WhatsApp"
    >
      <MessageCircle className="h-5 w-5" fill="white" />
    </a>
  );
};

export default FloatingWhatsApp;
