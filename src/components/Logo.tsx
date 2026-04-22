import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_URL } from '@/lib/siteAssets';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  height?: string;
}

const Logo = ({ variant = 'default', className = '', linkTo = '/', height = 'h-10 min-h-10 max-h-10' }: LogoProps) => {
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
      className={`block aspect-[111/40] w-auto max-w-full shrink-0 object-contain ${height} ${filterClass} ${className}`}
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
