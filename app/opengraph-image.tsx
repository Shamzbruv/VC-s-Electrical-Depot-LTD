import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const runtime='nodejs';
export const alt='VC’s Electrical Depot LTD — More Power, More Performance';
export const size={width:1200,height:630};
export const contentType='image/png';
export default async function Image(){const logo=await readFile(join(process.cwd(),'public/brand/logo-horizontal.png'));return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#f5f7fb',padding:65,flexDirection:'column',position:'relative'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><img src={'data:image/png;base64,'+logo.toString('base64')} width={420} height={140} alt=""/><span style={{fontSize:19,color:'#637494'}}>EST. 2006 • JAMAICA</span></div><div style={{display:'flex',flexDirection:'column',marginTop:38,fontSize:65,lineHeight:1.12,fontWeight:700,color:'#20326b'}}><span>More power.</span><span>More performance.</span></div><div style={{display:'flex',marginTop:30,fontSize:24,color:'#637494'}}>Electrical supplies • Contracting • Project support</div><div style={{position:'absolute',bottom:0,left:0,right:0,height:13,background:'#ffbf00',display:'flex'}}/><div style={{position:'absolute',bottom:45,left:65,fontSize:19,color:'#20326b',display:'flex'}}>21 Mannings Hill Road, Kingston 8 • 876-622-9800</div></div>,size)}
