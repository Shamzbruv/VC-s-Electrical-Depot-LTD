/** Deterministic multi-page PDF, generated on demand after authorization. */
export function invoicePdf(lines:string[]):Uint8Array {
 const clean=(s:string)=>s.replace(/[^\x20-\x7e]/g,' ').replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
 const wrapped=lines.flatMap(line=>{const out:string[]=[];let remaining=line;while(remaining.length>86){let cut=remaining.lastIndexOf(' ',86);if(cut<20)cut=86;out.push(remaining.slice(0,cut));remaining=remaining.slice(cut).trimStart()}out.push(remaining);return out});
 const pages:string[][]=[];for(let i=0;i<wrapped.length;i+=40)pages.push(wrapped.slice(i,i+40));if(!pages.length)pages.push(['']);
 const objects:string[]=['','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const pageIds:number[]=[];
 pages.forEach((page,i)=>{const pageId=objects.length+1,streamId=pageId+1;pageIds.push(pageId);objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>');const stream='BT /F1 11 Tf 48 790 Td 17 TL '+[...page,'','Page '+(i+1)+' / '+pages.length].map((l,j)=>(j?'T* ':'')+'('+clean(l)+') Tj').join('\n')+' ET';objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream')});
 objects[0]='<< /Type /Catalog /Pages 2 0 R >>';objects[1]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 let pdf='%PDF-1.4\n';const offsets:number[]=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const xref=pdf.length;pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return new TextEncoder().encode(pdf);
}
