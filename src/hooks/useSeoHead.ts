import { useEffect } from 'react';

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
}

export function useSeoHead({ title, description, canonical }: SeoHeadProps) {
  useEffect(() => {
    const fullTitle = `${title} | Preciso de um`;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', 'website', 'property');
    if (canonical) {
      setMeta('og:url', canonical, 'property');
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }

    return () => {
      document.title = 'Preciso de um';
    };
  }, [title, description, canonical]);
}
