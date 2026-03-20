import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/whatsapp';

interface Props {
  jobTitle?: string;
}

const FloatingWhatsApp = ({ jobTitle }: Props) => {
  const supportPhone = '5541997452053';
  const message = jobTitle
    ? `Olá! Vi a vaga "${jobTitle}" no Preciso de um e gostaria de mais informações.`
    : 'Olá! Preciso de ajuda no Preciso de um.';
  const url = whatsappLink(supportPhone, message);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
};

export default FloatingWhatsApp;
