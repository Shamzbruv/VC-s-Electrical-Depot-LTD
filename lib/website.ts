export const websitePages=[
  ['/', 'Home'],['/shop','Product catalogue'],['/quotes','Bulk quote request'],
  ['/info/about','About'],['/info/services','Services'],['/info/projects','Projects'],
  ['/info/contact','Contact'],['/info/shipping','Delivery and collection'],
  ['/info/faq','Frequently asked questions'],['/info/privacy','Privacy'],['/info/terms','Terms'],
] as const;

export type WebsiteValue={text?:string;src?:string;alt?:string;href?:string;hidden?:boolean};
export type WebsiteEdits=Record<string,WebsiteValue>;
export type Selection={id:string;name:string;current:WebsiteValue;original:WebsiteValue};
export const validRoute=(route:string)=>websitePages.some(([path])=>path===route);
export function websiteUrl(value:string,image=false) {
  if(value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\'))return true;
  if(!image&&value.startsWith('#'))return true;
  try {
    const link=new URL(value);
    return link.protocol==='https:'||(!image&&['tel:','mailto:'].includes(link.protocol));
  }catch{return false;}
}
