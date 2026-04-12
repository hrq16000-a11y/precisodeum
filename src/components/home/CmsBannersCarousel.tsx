import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHeroBanners, type HeroBannerData } from '@/hooks/useHeroBanners';

const CmsBannersCarousel = () => {
  const { data: banners = [] } = useHeroBanners();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[current] || banners[0];
  const overlayOpacity = banner.overlay_opacity ?? 0.8;
  const alignClass =
    banner.text_alignment === 'left' ? 'items-start text-left' :
    banner.text_alignment === 'right' ? 'items-end text-right' :
    'items-center text-center';

  return (
    <section className="relative overflow-hidden py-10 md:py-16">
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / ${overlayOpacity}) 0%, hsl(var(--primary) / ${Math.max(overlayOpacity - 0.15, 0.4)}) 100%)`,
        }}
      />

      <div className={`container relative z-10 flex flex-col ${alignClass}`}>
        <div key={banner.id} className="animate-fade-in">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl md:text-4xl drop-shadow-sm">
            {banner.title}
          </h2>
          {banner.subtitle && (
            <p className="mt-3 text-sm text-primary-foreground/80 md:text-base max-w-2xl leading-relaxed">
              {banner.subtitle}
            </p>
          )}
          {banner.cta_text && (
            <Link
              to={banner.cta_link || '/cadastro'}
              className="mt-4 inline-block rounded-lg bg-secondary px-6 py-2.5 text-sm font-semibold text-secondary-foreground shadow-md hover:opacity-90 transition-opacity"
            >
              {banner.cta_text}
            </Link>
          )}
        </div>

        {banners.length > 1 && (
          <div className="mt-5 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-secondary' : 'w-2 bg-primary-foreground/40 hover:bg-primary-foreground/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CmsBannersCarousel;
