import {cache} from 'react';
import {notFound} from 'next/navigation';
import {catalog} from '../../../lib/catalog';
import {Header,Footer,ProductCard} from '../../../components/ui';
import {BreadcrumbData,StructuredData} from '../../../components/structured-data';
import {absolute,pageMetadata,productPhoto,shareImage} from '../../../lib/seo';
import Detail from './product';

export const dynamic='force-dynamic';
type Params={params:Promise<{slug:string}>};
const products=cache(catalog);
const pathFor=(slug:string)=>'/product/'+encodeURIComponent(slug);

export async function generateMetadata({params}:Params) {
  const {slug}=await params;
  const product=(await products()).find(item=>item.slug===slug);
  if(!product)return {};
  const photo=productPhoto(product.image);
  return pageMetadata({
    path:pathFor(slug),
    title:product.name,
    description:product.description.trim().replace(/\s+/g,' ').slice(0,155)||'Enquire about '+product.name+' (SKU '+product.sku+') from our Kingston electrical depot.',
  },photo||shareImage('products'),{alt:photo?product.name:'VC’s Electrical Depot'});
}

export default async function Page({params}:Params) {
  const {slug}=await params;
  const all=await products();
  const product=all.find(item=>item.slug===slug);
  if(!product)notFound();
  const path=pathFor(slug);
  const photo=productPhoto(product.image);
  return <>
    <BreadcrumbData items={[{name:'Electrical products',path:'/shop'},{name:product.name,path}]}/>
    <StructuredData data={{
      '@context':'https://schema.org','@type':'Product',
      name:product.name,description:product.description||undefined,sku:product.sku,
      category:product.category,url:absolute(path),image:photo,
    }}/>
    <Header/>
    <Detail p={product}/>
    {all.length>1&&<section className="wrap section">
      <div className="section-heading"><h2>Related electrical products</h2><a href="/shop">All products →</a></div>
      <div className="product-grid">{all.filter(item=>item.id!==product.id).sort((a,b)=>Number(b.category===product.category)-Number(a.category===product.category)).slice(0,4).map(item=><ProductCard key={item.id} p={item}/>)}</div>
    </section>}
    <Footer/>
  </>;
}
