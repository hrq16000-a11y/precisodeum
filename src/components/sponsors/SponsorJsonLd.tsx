import { SponsorFull } from '@/hooks/useSponsors';
import { Helmet } from 'react-helmet-async';

interface Props {
  sponsors: SponsorFull[];
}

/** Schema.org LocalBusiness structured data for sponsors */
const SponsorJsonLd = ({ sponsors }: Props) => {
  if (sponsors.length === 0) return null;

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

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd)}
      </script>
    </Helmet>
  );
};

export default SponsorJsonLd;
