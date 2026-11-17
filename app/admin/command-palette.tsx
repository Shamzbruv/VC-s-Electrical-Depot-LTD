'use client';

import {useEffect,useState,type ComponentType} from 'react';
import {Command} from 'cmdk';
import {useRouter} from 'next/navigation';
import {Moon,Search,Sun} from 'lucide-react';

export type PaletteItem={id:string;title:string;group:string;href?:string;icon?:ComponentType<{size?:number}>;run?:()=>void;keywords?:string};

export default function CommandPalette({items,open,setOpen}:{items:PaletteItem[];open:boolean;setOpen:(open:boolean)=>void}) {
  const router=useRouter();
  const [value,setValue]=useState('');
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(!open);}
      if(e.key==='Escape')setOpen(false);
    };
    document.addEventListener('keydown',key);
    return ()=>document.removeEventListener('keydown',key);
  },[open,setOpen]);
  useEffect(()=>{if(!open)setValue('');},[open]);
  if(!open)return null;
  const groups=[...new Set(items.map(item=>item.group))];
  return <div className="ops-cmd" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
    <div className="ops-scrim" style={{zIndex:60}} onClick={()=>setOpen(false)}/>
    <Command label="Jump to a workspace or action" value={value} onValueChange={setValue}>
      <Command.Input autoFocus placeholder="Jump to a workspace or action…"/>
      <Command.List>
        <Command.Empty>No matches.</Command.Empty>
        {groups.map(group=><Command.Group key={group} heading={group}>
          {items.filter(item=>item.group===group).map(item=>{const Icon=item.icon||Search;return <Command.Item key={item.id} value={item.title+' '+(item.keywords||'')} onSelect={()=>{setOpen(false);if(item.run)item.run();else if(item.href)router.push(item.href);}}>
            <Icon size={18}/>{item.title}</Command.Item>;})}
        </Command.Group>)}
      </Command.List>
    </Command>
  </div>;
}
export {Moon,Sun};
