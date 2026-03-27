import { Link } from 'react-router-dom';
import { useSettingValue } from '@/hooks/useSiteSettings';

const DEFAULT_LOGO_URL = '/lovable-uploads/logo-transparent.png';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  height?: string;
}

const Logo = ({ variant = 'default', className = '', linkTo = '/', height = 'h-9 md:h-10' }: LogoProps) => {
  const logoUrl = useSettingValue('logo_url');
  const logo = logoUrl || DEFAULT_LOGO_URL;

  const filterClass = variant === 'white'
    ? 'brightness-0 invert'
    : variant === 'dark'
    ? 'brightness-0'
    : '';

  const img = (
    <img
      src={logo}
      alt="Preciso de um - Profissionais Confiáveis Perto de Você"
      className={`${height} ${filterClass} ${className}`}
      width="111"
      height="40"
    />
  );

  if (!linkTo) return img;

  return <Link to={linkTo}>{img}</Link>;
};

export default Logo;
