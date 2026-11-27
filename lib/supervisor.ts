export type DeliveryItem={name:string;quantity:number;unit:string;loaded:boolean};
export type DeliveryEmailJob={id:string;phase:string;state:string;created_at:string;sent_at?:string;error?:string};
export type Shipment={
  id:string;number:number;recipient:string;phone:string;address:string;description:string;delivery_date:string;notes:string;status:string;
  customer_email?:string;order_reference?:string;order_items?:DeliveryItem[];vehicle?:string;delivery_window?:string;received_by?:string;result_note?:string;
  started_at?:string;finished_at?:string;
  timeline?:{id:number;event:string;note?:string;created_at:string}[];
  emails?:DeliveryEmailJob[];
};
export type DeliverySetup={database:boolean;email:boolean;sender:string|null;scheduled:boolean};
export const deliveryStatus=(status:string)=>({
  pending:'Preparing',assigned:'Preparing',in_transit:'Out for delivery',delivered:'Arrived',issue:'Needs attention',cancelled:'Cancelled',
}[status]||status);
export const mailStatus=(status:string)=>({
  queued:'Queued',processing:'Sending',sent:'Sent to email provider',failed:'Retry pending',skipped:'Skipped',needs_review:'Review required',
}[status]||status);
