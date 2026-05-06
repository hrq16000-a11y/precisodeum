import { useEffect } from "react";

const SITEMAP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sitemap`;

const SitemapRedirect = () => {
  useEffect(() => {
    window.location.replace(SITEMAP_URL);
  }, []);
  return null;
};

export default SitemapRedirect;
