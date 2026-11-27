export type DeliveryMail={
  number:number;reference:string;recipient:string;email:string;address:string;date:string;window:string;
  items:{name:string;quantity:number;unit:string}[];received_by?:string;phase:'out_for_delivery'|'arrived';
};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));

export function deliveryEmail(mail:DeliveryMail,origin:string) {
  const arrived=mail.phase==='arrived';
  const subject=arrived?'Your VC’s Electrical Depot delivery has arrived':'Your VC’s Electrical Depot order is out for delivery';
  const heading=arrived?'Your delivery has arrived.':'Your order is on its way.';
  const reference=mail.reference||'VC-'+mail.number;
  const explanation=arrived
    ?'Our supervisor has confirmed that your items have arrived at the delivery address.'
    :'Our inventory supervisor has checked your items and released your delivery from the depot.';
  const when=new Intl.DateTimeFormat('en-JM',{timeZone:'America/Jamaica',dateStyle:'long'}).format(new Date(mail.date+'T12:00:00-05:00'));
  const rows=mail.items.map(item=>'<tr><td style="padding:13px 8px;border-bottom:1px solid #e4e9ef;">'+escape(item.name)+'</td><td style="padding:13px 8px;border-bottom:1px solid #e4e9ef;text-align:right;white-space:nowrap;">'+escape(item.quantity)+' '+escape(item.unit)+'</td></tr>').join('');
  const html='<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>'+
    '<body style="margin:0;padding:24px 12px;background:#f0f4f9;color:#152b4c;font-family:Arial,sans-serif;">'+
    '<div style="display:none;max-height:0;overflow:hidden;">'+escape(heading)+' Order '+escape(reference)+'</div>'+
    '<table role="presentation" style="width:100%;max-width:620px;margin:auto;border-collapse:collapse;background:white;border:1px solid #dce4ef;">'+
    '<tr><td style="padding:26px;text-align:center;border-top:6px solid #20326b;"><img src="'+escape(origin)+'/brand/logo-master.png" alt="VC’s Electrical Depot" width="190" style="width:190px;height:auto;max-width:100%;"></td></tr>'+
    '<tr><td style="padding:8px 28px 22px;"><p style="margin:0 0 12px;font-size:12px;letter-spacing:1.5px;color:#315687;font-weight:bold;">'+(arrived?'ARRIVAL CONFIRMED':'DELIVERY UPDATE')+'</p>'+
    '<h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;">'+heading+'</h1><p style="line-height:1.7;">Hi '+escape(mail.recipient)+',</p><p style="line-height:1.7;">'+explanation+'</p>'+
    '<div style="padding:16px;background:#eef4fc;border-left:4px solid #ffc52b;line-height:1.7;"><strong>Order '+escape(reference)+'</strong><br>'+
    escape(mail.address)+'<br>'+escape(when)+(mail.window?'<br>Delivery window '+escape(mail.window):'')+
    (arrived&&mail.received_by?'<br>Received by '+escape(mail.received_by):'')+'</div>'+
    '<h2 style="font-size:20px;margin:26px 0 8px;">Your order summary</h2><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr><th style="text-align:left;padding:8px;">Item</th><th style="text-align:right;padding:8px;">Quantity</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<p style="line-height:1.7;margin-top:22px;">'+(arrived?'Thank you for choosing VC’s Electrical Depot. If anything needs attention, contact our team and quote your order reference.':'Please keep your phone available so the delivery team can reach you if needed.')+'</p>'+
    '<a href="tel:+18766229800" style="display:inline-block;background:#20326b;color:white;text-decoration:none;padding:13px 20px;border-radius:6px;font-weight:bold;">Call the depot</a></td></tr>'+
    '<tr><td style="background:#f7f9fc;padding:22px 28px;font-size:12px;color:#52647c;line-height:1.8;"><strong>VC’s Electrical Depot LTD</strong><br>21 Mannings Hill Road, Kingston 8, Jamaica<br>'+
    '876-622-9800 · <a href="mailto:vcselectrical@gmail.com" style="color:#254d85;">vcselectrical@gmail.com</a></td></tr></table></body></html>';
  const text=[heading,'Hi '+mail.recipient+',',explanation,'Order '+reference,mail.address,when,mail.window,
    ...mail.items.map(item=>item.quantity+' '+item.unit+' — '+item.name),
    arrived&&mail.received_by?'Received by '+mail.received_by:'','VC’s Electrical Depot LTD','Call 876-622-9800'].filter(Boolean).join('\n\n');
  return{subject,html,text};
}
