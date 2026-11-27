import type {Metadata} from 'next';
import {categories,categoryImage} from './categories';
import {company} from './company';
import {ORIGIN} from './config';

export const siteOrigin = new URL(ORIGIN).origin;
export const absolute = (path: string) => new URL(path, siteOrigin).href;
export const storeId = absolute('/#depot');
export const noIndex = {index:false,follow:false};

export const publicPages = {
  home: {path:'/', title:'Electrical Supplies in Kingston, Jamaica', description:'Shop wholesale and retail electrical supplies in Kingston 8. Enquire about cables, lighting, breakers and electrical contracting from VC’s Electrical Depot.', image:'/hero.webp'},
  products: {path:'/shop', title:'Electrical Products & Materials in Kingston', description:'Browse electrical supplies from VC’s Kingston depot, including wiring, lighting, circuit protection, switches, sockets and conduit. Ask for availability.', image:'/hero.webp'},
  quotes: {path:'/quotes', title:'Bulk Electrical Supply Quotes in Jamaica', description:'Send your materials list to VC’s Electrical Depot for a wholesale or contractor quotation. Confirm quantities, availability and delivery with our Kingston team.'},
  about: {path:'/info/about', title:'About Our Kingston Electrical Depot', description:'Meet the team at VC’s Electrical Depot, a Kingston electrical materials supplier and contracting company serving Jamaica since 2006.'},
  services: {path:'/info/services', title:'Electrical Contracting & Project Services in Jamaica', description:'Electrical installations, underground infrastructure, transformer connections, solar systems and project support from VC’s Electrical Depot in Kingston.', image:'/hero.webp'},
  projects: {path:'/info/projects', title:'Completed Electrical Projects in Jamaica', description:'Explore VC’s past electrical installations and infrastructure projects in Jamaica, including work at Moon Palace Jamaica, UWI Mona and Medical Associates Hospital.'},
  contact: {path:'/info/contact', title:'Visit VC’s Electrical Depot in Kingston 8', description:'Find us at 21 Mannings Hill Road, Kingston 8, Jamaica. Call 876-622-9800 to check availability, opening hours or collection arrangements.'},
  shipping: {path:'/info/shipping', title:'Electrical Supply Delivery & Kingston Collection', description:'Ask about electrical supply delivery across Jamaica or arrange collection at 21 Mannings Hill Road, Kingston 8.'},
  faq: {path:'/info/faq', title:'Electrical Supply & Bulk Quote FAQs', description:'Answers about visiting our Kingston depot, wholesale and retail supply, requesting a quotation and checking product availability.'},
  privacy: {path:'/info/privacy', title:'Privacy', description:'How VC’s Electrical Depot handles enquiry, quotation and delivery information.'},
  terms: {path:'/info/terms', title:'Website Terms', description:'How to use the VC’s Electrical Depot product catalogue and request a quotation.'},
} satisfies Record<string,{path:string;title:string;description:string;image?:string}>;

export type SeoPage = {path:string;title:string;description:string;image?:string};
export const categoryPage = (category: typeof categories[number]):SeoPage => ({
  path:'/supplies/'+category.slug,
  title:category.name+' in Kingston, Jamaica',
  description:category.description,
  image:categoryImage(category.slug),
});

export const shareImage = (key:string) => '/share/'+key+'/image.png';
export const sharePages:Record<string,SeoPage> = {
  ...publicPages,
  ...Object.fromEntries(categories.map(category=>[category.slug,categoryPage(category)])),
};

export function pageMetadata(page:SeoPage, image:string, options:{index?:boolean;alt?:string;dimensions?:{width:number;height:number}}={}):Metadata {
  const url = absolute(page.path);
  const imageUrl = absolute(image);
  const title = page.title+' | '+company.displayName;
  return {
    title:page.title,
    description:page.description,
    alternates:{canonical:url},
    robots:options.index===false ? {index:false,follow:true} : {index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large'}},
    openGraph:{
      type:'website',locale:'en_JM',siteName:company.displayName,title,description:page.description,url,
      images:[{url:imageUrl,alt:options.alt||page.title,...options.dimensions}],
    },
    twitter:{card:'summary_large_image',title,description:page.description,images:[{url:imageUrl,alt:options.alt||page.title}]},
  };
}
export const brandedMetadata = (key:string) => pageMetadata(sharePages[key],shareImage(key),{dimensions:{width:1200,height:630}});

export function productPhoto(value:string) {
  try {
    const url = new URL(value,siteOrigin);
    if (url.protocol!=='https:' || url.username || url.password) return;
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname) || url.pathname.startsWith('/api/media/')) return url.href;
  } catch {}
}
