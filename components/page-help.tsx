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
    'Administrators and owners can open Role preview to explore each role’s workspaces with sample data.',
  ]],
  '/admin/finance':['Recording and reviewing finances',[
    'Choose Income or Expense. Enter the transaction date, amount in Jamaican dollars, category and payment method. Add the customer or supplier, reference and notes to make reconciliation easier.',
    'Post the entry after checking the amount. If you need to fix an entry, open its status, enter a void reason and post a corrected entry. The original stays visible as voided.',
    'Set the From and Through dates. With report access, review income, expenses, net activity, daily trends and category totals. Export CSV to download the ledger for the whole period.',
  ]],
  '/admin/dispatch':['Dispatching and following a package',[
    'Queue a package with its recipient, phone, destination, delivery date and contents. Add handover instructions or a landmark if needed.',
    'Choose an active driver from the delivery queue and select Assign driver. The driver sees the package in their workspace and receives an in-app notification.',
    'After acceptance, use the time and accuracy next to the last location update. If the update is stale, check in with the driver. Open on map shows the most recent point.',
    'Review Delivery history for status changes. Assign a new driver for an issue, or cancel with a reason when the delivery is called off.',
  ]],
  '/admin/driver':['Making a delivery',[
    'Open My deliveries and review the address, recipient number and package instructions.',
    'Check the location sharing box and select Accept and start delivery. Allow location access when your phone asks.',
    'Keep this page visible and your phone awake so dispatch can receive updates. Return to the Driver workspace after using your maps app.',
    'At handover, open Complete delivery or report an issue and choose Mark delivered. To report a failed attempt, enter what happened and choose Report issue. Both actions end tracking.',
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
    'Enter a staff member’s email, choose a role and decide whether to use the role defaults or customize individual workspaces.',
    'Choose Approve staff email, then open Edit access and click Create one-time setup link. Copy it and share it privately with the intended staff member.',
    'Open Edit access to change someone’s permissions or disable access. If a driver loses permission during delivery, dispatch receives an issue to reassign.',
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
