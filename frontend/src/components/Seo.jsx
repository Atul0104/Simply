import { useEffect } from 'react';

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

export default function Seo({ title, description, canonicalPath, image, type = 'website', schema, noindex = false }) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Perfurm` : 'Perfurm | Fine fragrance, thoughtfully discovered';
    const pageDescription = description || 'Discover modern perfume, discovery sets and home fragrance selected by Perfurm.';
    const canonical = new URL(canonicalPath || window.location.pathname, window.location.origin).toString();
    document.title = pageTitle;
    setMeta('meta[name="description"]', { name: 'description', content: pageDescription });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: pageTitle });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: pageDescription });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    setMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' });
    if (image) {
      setMeta('meta[property="og:image"]', { property: 'og:image', content: image });
      setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    }
    let canonicalElement = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.rel = 'canonical';
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.href = canonical;

    const scriptId = 'perfurm-structured-data';
    document.getElementById(scriptId)?.remove();
    if (schema) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
    return () => document.getElementById(scriptId)?.remove();
  }, [title, description, canonicalPath, image, type, schema, noindex]);
  return null;
}
