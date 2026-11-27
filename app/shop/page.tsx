import {Header,Footer} from '../../components/ui';
import {catalog} from '../../lib/catalog';
import {brandedMetadata,pageMetadata,publicPages,shareImage} from '../../lib/seo';
import Shop from './shop';

export const dynamic='force-dynamic';
type ShopParams={searchParams:Promise<{q?:string|string[];category?:string|string[]}>};
export async function generateMetadata({searchParams}:ShopParams) {
  const {q,category}=await searchParams;
  return q||category ? pageMetadata(publicPages.products,shareImage('products'),{index:false}) : brandedMetadata('products');
}
export default async function Page({searchParams}:ShopParams) {
  const [products,{q,category}]=await Promise.all([catalog(),searchParams]);
  return <><Header/><Shop products={products} initialSearch={typeof q==='string'?q:''} initialCategory={typeof category==='string'?category:''}/><Footer/></>;
}
