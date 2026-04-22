import { Link } from 'react-router-dom';
import { DEFAULT_LOGO_PNG_SRCSET, DEFAULT_LOGO_SRCSET, DEFAULT_LOGO_URL } from '@/lib/siteAssets';
import { handleBrandImageError } from '@/lib/imageResolver';

interface LogoProps {
  variant?: 'default' | 'white' | 'dark';
  className?: string;
  linkTo?: string;
  priority?: boolean;
  sizes?: string;
}

const Logo = ({ variant = 'default', className = '', linkTo = '/', priority = false, sizes = '(max-width: 639px) 155px, 133px' }: LogoProps) => {
  const logo = DEFAULT_LOGO_URL;

  const filterClass = variant === 'white'
    ? 'brightness-0 invert'
    : variant === 'dark'
    ? 'brightness-0'
    : '';

  const img = (
    <picture>
      <source type="image/webp" srcSet={DEFAULT_LOGO_SRCSET} sizes={sizes} />
      <img
        src={logo}
        srcSet={DEFAULT_LOGO_PNG_SRCSET}
        sizes={sizes}
        alt="Preciso de um Profissional"
        className={`block h-14 min-h-14 max-h-14 aspect-[111/40] w-auto max-w-full shrink-0 object-contain sm:h-12 sm:min-h-12 sm:max-h-12 ${filterClass} ${className}`}
        width="710"
        height="209"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={(e) => handleBrandImageError(e, 'logo')}
      />
    </picture>
  );

  if (!linkTo) return img;

  return <Link to={linkTo}>{img}</Link>;
};

export default Logo;
