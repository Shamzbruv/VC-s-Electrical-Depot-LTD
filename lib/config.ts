export const SB_URL='https://lfiasedcinrrikwkbbeb.supabase.co';
export const ORIGIN='https://vcs-electrical-depot.shamzbruv.chatgpt.site';
export const BRAND="VC’s Electrical Depot LTD";
export const money=(v:number)=>'J$'+(v/100).toLocaleString('en-JM',{minimumFractionDigits:2,maximumFractionDigits:2});
export type Product={id:string;name:string;slug:string;sku:string;category:string;description:string;image:string;price:number;store_price:number;stock:number;reserved:number;unit:string;status:string;specs:Record<string,string>;featured:boolean;sample:boolean;updated_at:string};
