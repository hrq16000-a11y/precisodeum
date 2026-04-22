import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_SRCSET, DEFAULT_LOGO_URL } from '@/lib/siteAssets';

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
      srcSet={DEFAULT_LOGO_SRCSET}
      sizes="(max-width: 639px) 155px, 133px"
      alt="Preciso de um Profissional"
      className={`block h-14 min-h-14 max-h-14 aspect-[111/40] w-auto max-w-full shrink-0 object-contain sm:h-12 sm:min-h-12 sm:max-h-12 ${filterClass} ${className}`}
      width="710"
      height="209"
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
