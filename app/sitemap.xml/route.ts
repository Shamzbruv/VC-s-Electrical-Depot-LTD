import {catalog} from '../../lib/catalog';
import {categories} from '../../lib/categories';
import {absolute,categoryPage,productPhoto,publicPages} from '../../lib/seo';

const xml = (value:string) => value.replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;',
}[character]!));

export async function GET() {
  const products=await catalog();
  const pages=[
    ...Object.values(publicPages),
    ...categories.map(categoryPage),
    ...products.map(product=>({path:'/product/'+encodeURIComponent(product.slug),image:productPhoto(product.image)})),
  ];
  const urls=pages.map(({path,...page})=>{
    const image='image' in page&&page.image ? '<image:image><image:loc>'+xml(absolute(page.image))+'</image:loc></image:image>' : '';
    return '<url><loc>'+xml(absolute(path))+'</loc>'+image+'</url>';
  });
  return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'+urls.join('\n')+'\n</urlset>',{
    headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'},
  });
}
