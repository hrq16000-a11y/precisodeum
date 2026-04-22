import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_URL } from '@/lib/siteAssets';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  height?: string;
}

const Logo = ({ variant = 'default', className = '', linkTo = '/', height = 'h-20 md:h-28' }: LogoProps) => {
  const logo = DEFAULT_LOGO_URL;

  const filterClass = variant === 'white'
    ? 'brightness-0 invert'
    : variant === 'dark'
    ? 'brightness-0'
    : '';

  const img = (
    <img
      src={logo}
      alt="Preciso de um Profissional"
      className={`${height} ${filterClass} ${className}`}
      width="111"
      height="40"
      onError={(e) => {
        const t = e.currentTarget;
        if (t.src.indexOf(DEFAULT_LOGO_URL) === -1) t.src = DEFAULT_LOGO_URL;
      }}
    />
  );

  if (!linkTo) return img;

  return <Link to={linkTo}>{img}</Link>;
};

export default Logo;
