import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {sharePages} from '../../../../lib/seo';

export const runtime='nodejs';

export async function GET(_request:Request,{params}:{params:Promise<{key:string}>}) {
  const {key}=await params;
  if(!Object.hasOwn(sharePages,key))return new Response(null,{status:404});
  const page=sharePages[key];
  const logo=await readFile(join(process.cwd(),'public/brand/logo-master.png'));
  const photo=page.image
    ? await sharp(join(process.cwd(),'public',page.image)).resize(440,440,{fit:'cover'}).jpeg({quality:83}).toBuffer()
    : null;
  return new ImageResponse(
    <div style={{display:'flex',position:'relative',width:'100%',height:'100%',background:'#f5f7fb',color:'#1c2e63',borderBottom:'14px solid #ffbf00',padding:56,alignItems:'center'}}>
      <div style={{display:'flex',flexDirection:'column',width:photo?620:1040}}>
        <img src={'data:image/png;base64,'+logo.toString('base64')} width={250} height={140} alt=""/>
        <div style={{display:'flex',fontSize:photo?55:65,fontWeight:700,lineHeight:1.12,marginTop:26}}>{page.title}</div>
        <div style={{display:'flex',fontSize:24,marginTop:28,color:'#455678'}}>21 Mannings Hill Road, Kingston 8</div>
        <div style={{display:'flex',fontSize:24,marginTop:8,color:'#455678'}}>876-622-9800</div>
      </div>
      {photo&&<img src={'data:image/jpeg;base64,'+photo.toString('base64')} width={440} height={440} alt="" style={{objectFit:'cover',borderRadius:26,marginLeft:26}}/>}
    </div>,
    {width:1200,height:630,headers:{'Cache-Control':'public, max-age=86400'}},
  );
}
