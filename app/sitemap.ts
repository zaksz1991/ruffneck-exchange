import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: 'daily', priority: 1 },
    { url: `${site.url}/marketplace`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site.url}/business/register`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${site.url}/request`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site.url}/ruffneck`, changeFrequency: 'weekly', priority: 0.7 },
  ];
}
