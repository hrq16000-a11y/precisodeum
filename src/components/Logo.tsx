import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_URL } from '@/lib/siteAssets';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
}

const Logo = ({ variant = 'default', className = '', linkTo = '/' }: LogoProps) => {
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
      className={`block h-12 min-h-12 max-h-12 aspect-[111/40] w-auto max-w-full shrink-0 object-contain ${filterClass} ${className}`}
      width="111"
      height="40"
      decoding="async"
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
