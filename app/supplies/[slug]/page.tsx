import {notFound} from 'next/navigation';
import {Header,Footer,ProductCard} from '../../../components/ui';
import {BreadcrumbData} from '../../../components/structured-data';
import {catalog} from '../../../lib/catalog';
import {categories,categoryImage} from '../../../lib/categories';
import {brandedMetadata,categoryPage} from '../../../lib/seo';
import {company} from '../../../lib/company';

type Params={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';

export async function generateMetadata({params}:Params) {
  const {slug}=await params;
  return categories.some(category=>category.slug===slug) ? brandedMetadata(slug) : {};
}

export default async function SuppliesPage({params}:Params) {
  const {slug}=await params;
  const category=categories.find(entry=>entry.slug===slug);
  if(!category)notFound();
  const products=(await catalog()).filter(product=>product.category.toLowerCase()===category.name.toLowerCase());
  const page=categoryPage(category);
  return <>
    <BreadcrumbData items={[{name:'Electrical products',path:'/shop'},{name:category.name,path:page.path}]}/>
    <Header/>
    <main className="wrap section">
      <a href="/shop">Browse electrical products</a>
      <section className="product-detail">
        <div className="product-gallery"><img src={categoryImage(slug)} alt={category.alt} width="640" height="640"/></div>
        <div className="product-detail-copy">
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <h2>What to include in your enquiry</h2>
          <p>{category.checklist}</p>
          <p>Call <a href={company.phoneHref}>{company.phone}</a> to check availability and collection, or send us your materials list for delivery pricing.</p>
          <a href="/quotes" className="button blue">Request a quote</a>
        </div>
      </section>
      {products.length>0&&<section>
        <h2>Browse {category.name.toLowerCase()}</h2>
        <div className="product-grid">{products.map(product=><ProductCard key={product.id} p={product}/>)}</div>
      </section>}
      <nav aria-label="Related electrical supply categories" className="section">
        <h2>Other electrical supplies</h2>
        <ul>{categories.filter(entry=>entry.slug!==slug).map(entry=><li key={entry.slug}><a className="text-link" href={'/supplies/'+entry.slug}>{entry.name}</a></li>)}</ul>
      </nav>
    </main>
    <Footer/>
  </>;
}
