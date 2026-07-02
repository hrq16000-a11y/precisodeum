import { useEffect } from 'react';
import { SponsorFull } from '@/hooks/useSponsors';

interface Props {
  sponsors: SponsorFull[];
}

/** Schema.org LocalBusiness structured data for sponsors - injected via DOM */
const SponsorJsonLd = ({ sponsors }: Props) => {
  useEffect(() => {
    if (sponsors.length === 0) return;

    const jsonLd = sponsors.map(s => ({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: s.company_name || s.title,
      description: s.full_description || s.short_description,
      telephone: s.phone,
      url: s.external_link || s.link_url,
      image: s.logo_url || s.image_url,
      ...(s.linked_city && {
        address: {
          '@type': 'PostalAddress',
          addressLocality: s.linked_city,
          addressCountry: 'BR',
        },
      }),
    }));

    const id = 'sponsor-jsonld';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd);

    return () => { script?.remove(); };
  }, [sponsors]);

  return null;
};

export default SponsorJsonLd;
