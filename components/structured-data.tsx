import {absolute} from '../lib/seo';

export function StructuredData({data}:{data:object}) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>;
}

export function BreadcrumbData({items}:{items:{name:string;path:string}[]}) {
  return <StructuredData data={{
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[{name:'Home',path:'/'},...items].map(({name,path},index)=>({
      '@type':'ListItem',position:index+1,name,item:absolute(path),
    })),
  }}/>;
}
