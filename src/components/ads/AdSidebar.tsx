import AdBanner from './AdBanner';
import { useIsMobile } from '@/hooks/use-mobile';

interface AdSidebarProps {
  position?: string;
  className?: string;
}

/** 300x250 sticky sidebar ads — hidden on mobile */
const AdSidebar = ({ position = 'sidebar', className = '' }: AdSidebarProps) => {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <div className={`hidden lg:block w-[300px] shrink-0 ${className}`}>
      <AdBanner position={position} sticky maxWidth={300} />
    </div>
  );
};

export default AdSidebar;
