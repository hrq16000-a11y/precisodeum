import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';
import { useLocation } from 'react-router-dom';

interface Props {
  jobTitle?: string;
}

const FloatingWhatsApp = ({ jobTitle }: Props) => {
  const supportPhone = '5541997452053';
  const message = jobTitle
    ? `Olá! Vi a vaga "${jobTitle}" no Preciso de um e gostaria de mais informações.`
    : 'Olá! Preciso de ajuda no Preciso de um.';
  const url = whatsappLink(supportPhone, message);

  const location = useLocation();
  // Hide on paths where bottom nav is hidden (admin, login, dashboard, etc.)
  const hiddenPaths = ['/admin', '/login', '/cadastro', '/reset-password', '/dashboard', '/sponsor-panel'];
  const hasBottomNav = !hiddenPaths.some(p => location.pathname.startsWith(p));

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${
        hasBottomNav ? 'bottom-[4.5rem] md:bottom-5' : 'bottom-5'
      }`}
      style={hasBottomNav ? { marginBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
};

export default FloatingWhatsApp;
