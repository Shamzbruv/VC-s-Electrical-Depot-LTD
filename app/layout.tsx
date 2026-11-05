import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'VC’s Electrical Depot LTD | Power your next project',template:'%s | VC’s Electrical Depot LTD'},description:'Explore electrical cables, circuit protection, lighting, switches and tools. Request a project quotation from VC’s Electrical Depot LTD, Jamaica.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en-JM"><body>{children}</body></html>}
