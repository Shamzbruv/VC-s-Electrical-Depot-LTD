'use client';

import {useState} from 'react';
import {ProductCard,ArrowRight} from '../../components/ui';
import {categories as supplyCategories} from '../../lib/categories';
import type {Product} from '../../lib/config';

export default function Shop({products,initialSearch,initialCategory}:{products:Product[];initialSearch:string;initialCategory:string}) {
  const [search,setSearch]=useState(initialSearch);
  const [category,setCategory]=useState(initialCategory);
  const categories=[...new Set(products.map(item=>item.category))].sort();
  const selected=products.filter(item=>(!category||item.category===category)&&[item.name,item.sku,item.description].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <main className="wrap section">
    <div className="section-heading"><div><span className="eyebrow">VC’S ELECTRICAL DEPOT</span><h1>Electrical products in Kingston</h1><p>Browse selected products or ask us to source the materials you need.</p></div><a href="/quotes">Request a bulk quotation <ArrowRight size={17}/></a></div>
    <nav aria-label="Electrical supply categories" className="supply-category-links">
      {supplyCategories.map(category=><a className="text-link" key={category.slug} href={'/supplies/'+category.slug}>{category.name}</a>)}
    </nav>
    {products.length>0&&<div className="catalog-filters" data-website-ignore>
      <label className="field">Search products<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or SKU"/></label>
      <label className="field">Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(name=><option key={name}>{name}</option>)}</select></label>
    </div>}
    {selected.length?<div className="product-grid">{selected.map(item=><ProductCard key={item.id} p={item}/>)}</div>:<div className="notice">{products.length?'No products match your filters.':'Looking for specific electrical materials? Send our team a list of the products and quantities you need.'}</div>}
    <a className="button blue" href="/quotes">Tell us what you need <ArrowRight size={17}/></a>
  </main>;
}
