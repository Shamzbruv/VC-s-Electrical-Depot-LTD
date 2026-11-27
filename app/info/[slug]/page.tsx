import {notFound} from 'next/navigation';
import {Header,Footer} from '../../../components/ui';
import {BreadcrumbData,StructuredData} from '../../../components/structured-data';
import {content} from '../../../lib/catalog';
import {AboutPage,ServicesPage,ProjectsPage,ContactPage} from '../../../components/company-pages';
import {company,companyInformationPages,services} from '../../../lib/company';
import {absolute,brandedMetadata,pageMetadata,publicPages,shareImage,storeId} from '../../../lib/seo';

export const dynamic='force-dynamic';
type Params={params:Promise<{slug:string}>};
const pages={about:AboutPage,services:ServicesPage,projects:ProjectsPage,contact:ContactPage};

export async function generateMetadata({params}:Params) {
  const {slug}=await params;
  if(slug!=='home'&&slug!=='products'&&slug!=='quotes'&&Object.hasOwn(publicPages,slug))return brandedMetadata(slug);
  const data=await content(slug);
  if(!data)return {};
  return pageMetadata({
    path:'/info/'+encodeURIComponent(slug),title:data.title,description:data.body.replace(/\s+/g,' ').slice(0,160),
  },shareImage('home'));
}

export default async function Page({params}:Params) {
  const {slug}=await params;
  const path='/info/'+encodeURIComponent(slug);
  const Known=Object.hasOwn(pages,slug) ? pages[slug as keyof typeof pages] : undefined;
  if(Known)return <>
    <BreadcrumbData items={[{name:publicPages[slug as keyof typeof pages].title,path}]}/>
    {slug==='services'&&<StructuredData data={{
      '@context':'https://schema.org',
      '@graph':services.map(service=>({
        '@type':'Service',name:service.title,description:service.description,
        url:absolute(path),provider:{'@id':storeId,name:company.displayName},areaServed:{'@type':'Country',name:'Jamaica'},
      })),
    }}/>}
    <Header/><main><Known/></main><Footer/>
  </>;
  const data=Object.hasOwn(companyInformationPages,slug) ? companyInformationPages[slug] : await content(slug);
  if(!data)notFound();
  return <>
    <BreadcrumbData items={[{name:data.title,path}]}/>
    <Header/>
    <main className="wrap prose-page">
      <span className="eyebrow">VC’S ELECTRICAL DEPOT LTD</span>
      <h1>{data.title}</h1>
      <div className="prose">{data.body.split('\n\n').map((paragraph:string,index:number)=><p key={index}>{paragraph}</p>)}</div>
      <a className="button blue" href="/info/contact">Contact the team →</a>
    </main>
    <Footer/>
  </>;
}
