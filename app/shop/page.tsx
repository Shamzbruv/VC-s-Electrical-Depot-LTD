import {Header,Footer} from '../../components/ui';
import {catalog} from '../../lib/catalog';
import Shop from './shop';

export const dynamic='force-dynamic';
export const metadata={title:'Electrical products'};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string|string[];category?:string|string[]}>}) {
  const [products,{q,category}]=await Promise.all([catalog(),searchParams]);
  return <><Header/><Shop products={products} initialSearch={typeof q==='string'?q:''} initialCategory={typeof category==='string'?category:''}/><Footer/></>;
}
