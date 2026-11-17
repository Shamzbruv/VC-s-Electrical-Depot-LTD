import {notFound} from 'next/navigation';

const workspaces=['finance','dispatch','driver','enquiries','products','website','access'];
export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
export function generateStaticParams(){return workspaces.map(section=>({section}));}
export default async function Page({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(!workspaces.includes(section))notFound();
  return null;
}
