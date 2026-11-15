import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/marketplace', '/request', '/business/register', '/how-it-works', '/about', '/ruffneck', '/privacy', '/terms'];
  return pages.map((path, index) => ({ url: `${site.url}${path}`, lastModified: new Date(), changeFrequency: index < 2 ? 'weekly' : 'monthly', priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.5 }));
}
