'use client';

import {usePathname} from 'next/navigation';
import {CircleHelp,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

const guide:Record<string,[string,string[]]>={
  '/admin':['Using the staff portal',[
    'Sign in with your staff email and password. If the owner sent you a one-time setup link, open it and choose your password.',
    'Open the sidebar to find the tools assigned to your account. If a workspace is missing, ask the owner to update your permissions.',
    'The overview shows activity for the workspaces you can access. Open a card to follow up on enquiries, manage products, open a draft, review accounting or check deliveries.',
    'Open the bell for staff notifications and mark them read after reviewing them.',
    'Owners and admins can open Role preview to explore the two standard portals with sample data.',
  ]],
  '/admin/dispatch':['Preparing and supervising deliveries',[
    'Enter the customer’s name, email, phone and destination. Copy the order or invoice reference from the accounting system so both teams can identify the same order.',
    'Add each item, quantity and unit. Check Loaded after the item is in the truck, then save the checklist.',
    'Select Confirm out for delivery and check the customer email before confirming. This records departure and queues a branded email with the order summary.',
    'After receiving confirmation from the delivery team, select Confirm arrival. Record who received the goods and confirm. This queues the arrival email.',
    'Use Report issue for a failed attempt or Cancel delivery if the delivery is called off. The history keeps every recorded change.',
  ]],
  '/admin/automations':['Customer email automation',[
    'The connection panel shows whether the email service and retry schedule are ready.',
    'Review the branded email preview for departure and arrival. These examples use sample customer details.',
    'Every confirmed departure or arrival creates a saved email job. Successful provider acceptance is recorded as sent. The worker retries temporary failures using the same message ID.',
    'Use Process queued emails to request another pass through the queue. Updates marked Review required need a provider-log check before any further customer contact.',
  ]],
  '/admin/reports':['Operations reports',[
    'Choose From and Through dates to review deliveries created during that period in Jamaica time.',
    'Review arrivals, open deliveries, issues and overdue work. Open Deliveries for the individual order summary and event history.',
    'Export a delivery manifest to compare the existing order references with the accounting system. The export contains up to 1,000 records, so choose a shorter period when needed.',
  ]],
  '/admin/enquiries':['Handling a customer request',[
    'Read the customer’s message and check whether it is a bulk quotation or general enquiry.',
    'Use the displayed email or phone to reply. Choose Reviewing while checking stock or scope, Quoted when you send the quote, or Closed once the request is resolved.',
  ]],
  '/admin/products':['Managing private and public products',[
    'Select Add product, then enter the name, SKU, category and description. Add an image URL if you have one. New products stay private.',
    'For a CSV import, use a header row with name, sku and category. You may add slug, description, image and unit. Review the displayed row count before importing.',
    'Search for an item and choose Make public or Make private. To update the entire catalogue, use Make all public or Make all private and confirm. Sample listings stay private until you save real product details in their place.',
  ]],
  '/admin/website':['Editing and publishing a page',[
    'Choose a page and desktop or mobile preview. Click a highlighted heading, paragraph, image or link in the preview to open its settings.',
    'For an image, upload a JPEG, PNG or WebP from your device, reuse a photo from the media library, or enter an image URL. Click Apply in preview to review the change. Use Restore original to remove a change. Edit shared header and footer content from Home.',
    'Save draft to continue later. When ready, review the preview and choose Publish page, then confirm. Discard draft restores the live version in the preview.',
    'Update product listings and their visibility in Products. Use this editor for page content.',
  ]],
  '/admin/access':['Setting up staff permissions',[
    'Enter a staff member’s email, choose Owner or Admin and customize which workspaces an Admin can use. Give the inventory supervisor Delivery supervision.',
    'Choose Approve staff email, then open Edit access and click Create one-time setup link. Copy it and share it privately with the intended staff member.',
    'Open Edit access to change an Admin’s permissions or disable their access. Existing owner accounts are protected from changes in this screen.',
  ]],
};

export default function PageHelp() {
  const path=usePathname();
  const [available,setAvailable]=useState(false);
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const toggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{setAvailable(window.parent===window);},[]);
  useEffect(()=>{setOpen(false);dialog.current?.close();},[path]);
  const [heading,steps]=guide[path]||guide['/admin'];
  if(!available)return null;
  return <div className="page-help" data-website-ignore>
    <button ref={toggle} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{dialog.current?.showModal();setOpen(true);}}><CircleHelp size={20}/> Help</button>
    <dialog ref={dialog} onClose={()=>{setOpen(false);toggle.current?.focus();}} aria-labelledby="page-help-title">
      <button className="help-close" aria-label="Close help" onClick={()=>dialog.current?.close()}><X size={22}/></button>
      <h2 id="page-help-title">{heading}</h2><ol>{steps.map(step=><li key={step}>{step}</li>)}</ol>
    </dialog>
  </div>;
}
