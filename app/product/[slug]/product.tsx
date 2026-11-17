import {ArrowRight} from 'lucide-react';
import type {Product} from '../../../lib/config';

export default function Detail({p}:{p:Product}) {
  return <main className="wrap section">
    <a href="/shop">← Browse products</a>
    <div className="product-detail">
      <div className="product-gallery"><img src={p.image} alt={p.name}/></div>
      <div className="product-detail-copy">
        <span className="eyebrow">{p.category}</span>
        <h1>{p.name}</h1>
        <p>{p.description}</p>
        <p>SKU {p.sku} · Unit {p.unit}</p>
        {Object.keys(p.specs||{}).length>0&&<dl>{Object.entries(p.specs).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}</dl>}
        <a className="button blue" href={'/quotes?product='+encodeURIComponent(p.name)+'&sku='+encodeURIComponent(p.sku)}>Enquire about this product <ArrowRight size={17}/></a>
      </div>
    </div>
  </main>;
}
