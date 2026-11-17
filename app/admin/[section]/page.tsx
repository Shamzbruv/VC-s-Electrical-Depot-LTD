import Admin from '../admin';
import {notFound} from 'next/navigation';

export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(!['finance','dispatch','driver','enquiries','products','website','access'].includes(section))notFound();
  return <Admin section={section}/>;
}
