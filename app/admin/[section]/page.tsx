import {notFound,redirect} from 'next/navigation';

const workspaces=['dispatch','automations','reports','enquiries','products','website','access'];
export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
export function generateStaticParams(){return workspaces.map(section=>({section}));}
export default async function Page({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(section==='driver')redirect('/admin/dispatch');
  if(section==='finance')redirect('/admin/reports');
  if(!workspaces.includes(section))notFound();
  return null;
}
