'use client';
import {useState} from 'react';
import {Zap,Search,UserRound,ShoppingCart,ChevronDown,ArrowRight,Menu,X,MapPin,Truck,ShieldCheck,PackageCheck,Headphones,Check,Plus,Minus} from 'lucide-react';
import {money,Product} from '../lib/config';
import {company} from '../lib/company';
export {Zap,Search,UserRound,ShoppingCart,ChevronDown,ArrowRight,Menu,X,MapPin,Truck,ShieldCheck,PackageCheck,Headphones,Check,Plus,Minus};
export function Brand({light=false}:{light?:boolean}) {
  return <a className={'brand brand-official sales-brand '+(light?'light':'')} href="/" aria-label="VC’s Electrical Sales home">
    <span className="sales-mark"><img src="/brand/logo-mark.webp" alt="" width="76" height="76"/></span>
    <span className="sales-wordmark"><strong>Electrical</strong><b>Sales</b></span>
  </a>;
}
export function Header() {
  const [open,setOpen]=useState(false);
  return <><div className="topline"><div className="wrap"><span><Zap size={13}/> Powering Jamaica since 2006.</span><div><a href={company.phoneHref}>Call {company.phone}</a></div></div></div>
    <header className="store-header">
      <div className="wrap main-header">
        <Brand/>
        <form className="search-box" action="/shop" data-website-ignore><Search size={19}/><input name="q" placeholder="Search published products…" aria-label="Search products"/><button aria-label="Submit search"><ArrowRight size={18}/></button></form>
        <div className="header-actions"><a href="/info/contact"><Headphones size={20}/><span>Contact</span></a><button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>{open?<X/>:<Menu/>}</button></div>
      </div>
      <div className={'navrow '+(open?'open':'')}><nav className="wrap">
        <a className="category-nav" href="/shop"><PackageCheck size={18}/> Products</a>
        <a href="/info/services">Our services</a><a href="/info/projects">Our projects</a><a href="/info/about">About VC’s</a><a href="/info/contact">Contact</a>
        <a href="/quotes" className="nav-quote">Request a bulk quote <ArrowRight size={15}/></a>
      </nav></div>
    </header></>;
}
export function Footer(){return <footer><div className="wrap footer-grid"><div><Brand light/><p>{company.tagline}</p><small>Electrical supplies & contracting<br/>Wholesale & retail • Established 2006</small><div className="footer-contact"><a href={company.phoneHref}>{company.phone}</a><a href={'mailto:'+company.email}>{company.email}</a><a href={company.mapsHref} target="_blank" rel="noreferrer">21 Mannings Hill Road<br/>Kingston 8, Jamaica</a></div></div><div><h4>Explore VC’s</h4><a href="/shop">Browse products</a><a href="/info/services">Products & services</a><a href="/info/projects">Completed projects</a><a href="/info/about">Our story & team</a><a href="/quotes">Trade & bulk quotations</a></div><div><h4>Here to help</h4><a href="/info/shipping">Delivery & collection</a><a href="/info/faq">Frequently asked questions</a><a href="/info/contact">Contact the depot</a></div><div className="footer-project"><img className="footer-monogram" src="/brand/logo-mark.webp" alt="" width="80" height="80"/><span className="eyebrow">LET’S GET TO WORK</span><h3>Your project.<br/>Our experience.</h3><p>From a materials list to an electrical installation. Let’s make the right connection.</p><a href="/quotes">Get a project quote <ArrowRight size={17}/></a></div></div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} {company.name}</span><div><a href="/info/privacy">Privacy</a><a href="/info/terms">Terms</a><a href="/admin">Staff portal <ArrowRight size={12}/></a></div></div></footer>}
export function ProductCard({p}:{p:Product}) {
  return <article className="product-card"><a href={'/product/'+p.slug} className="product-picture">
    <img src={p.image} alt={p.name} loading="lazy"/><span className="quick-look">View product <ArrowRight size={14}/></span></a>
    <div className="product-info"><span className="product-category">{p.category}</span><a href={'/product/'+p.slug}><h3>{p.name}</h3></a>
    <p className="product-spec">{p.description}</p><a className="text-link" href={'/quotes?product='+encodeURIComponent(p.name)+'&sku='+encodeURIComponent(p.sku)}>Request availability <ArrowRight size={14}/></a></div></article>;
}
export function Toast({text}:{text:string}){return text?<div className="toast" role="status">{text}</div>:null}
export async function api(action:string,data?:any,token?:string):Promise<any>{const r=await fetch('/api/store'+(data?'':'?action='+action),{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify({action,...data})}:{})});const d:any=await r.json();if(!r.ok)throw new Error(d.error||'Something went wrong');return d;}
