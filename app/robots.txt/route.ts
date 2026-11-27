import {absolute} from '../../lib/seo';

export function GET() {
  // Let crawlers see noindex on staff pages. APIs are irrelevant to public discovery.
  return new Response('User-agent: *\nDisallow: /api/\nAllow: /api/media/\nSitemap: '+absolute('/sitemap.xml')+'\n',{
    headers:{'Content-Type':'text/plain; charset=utf-8'},
  });
}
