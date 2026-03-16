interface Sponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
}

interface Props {
  sponsors: Sponsor[];
}

const SponsorsSection = ({ sponsors }: Props) => {
  const bannerSponsors = sponsors.filter(s => s.position === 'banner');
  const cardSponsors = sponsors.filter(s => s.position === 'card' || s.position === 'featured');

  if (bannerSponsors.length === 0 && cardSponsors.length === 0) return null;

  return (
    <>
      {bannerSponsors.length > 0 && (
        <section className="py-10">
          <div className="container">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Patrocinadores</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {bannerSponsors.map((sponsor) => (
                <a
                  key={sponsor.id}
                  href={sponsor.link_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-opacity hover:opacity-80"
                  title={sponsor.title}
                >
                  {sponsor.image_url ? (
                    <img src={sponsor.image_url} alt={sponsor.title} className="h-12 max-w-[200px] object-contain" />
                  ) : (
                    <span className="rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground">
                      {sponsor.title}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {cardSponsors.length > 0 && (
        <section className="pb-10">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cardSponsors.map((sponsor) => (
                <a
                  key={sponsor.id}
                  href={sponsor.link_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Patrocinado
                  </div>
                  {sponsor.image_url && (
                    <img src={sponsor.image_url} alt={sponsor.title} className="mt-3 h-20 w-full rounded-lg object-cover" />
                  )}
                  <h3 className="mt-3 font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {sponsor.title}
                  </h3>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default SponsorsSection;
