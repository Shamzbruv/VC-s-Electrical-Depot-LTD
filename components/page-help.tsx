'use client';

import {usePathname} from 'next/navigation';
import {CircleHelp,X} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

const guide:Record<string,[string,string[]]>={
  '/':['Finding what you need',[
    'Use Products to browse the items VC’s has chosen to show online. You can also ask about an item using its name, model number or SKU.',
    'Use Request a bulk quote if you have a materials list, quantity or project deadline. Include your best contact details so the depot can follow up.',
    'Use Our services or Our projects to learn about electrical contracting. Open Contact for the depot’s phone, email and location.',
  ]],
  '/shop':['Using the product catalogue',[
    'Type a product name or SKU into Search. Open a result for its description and specifications.',
    'Choose Request availability to include that product in a quote. Add the quantity, unit or size you need and mention any deadline.',
    'If your product is missing from the catalogue, use the bulk quote form to describe it.',
  ]],
  '/product':['Requesting this product',[
    'Review the product information and note the SKU. Select Request availability to start a quote with the product already filled in.',
    'Add quantities, pack sizes, any suitable alternatives and the date you need them.',
  ]],
  '/quotes':['Submitting a bulk quote',[
    'Enter your name and email. Add your company and phone so the team has another way to reach you.',
    'List the products, quantities and any specifications. If you know your collection or delivery date or project site, include it.',
    'Confirm that the depot may use your details to reply and submit. Keep the confirmation reference if one is shown.',
  ]],
  '/info/contact':['Contacting the depot',[
    'Call or email the depot using the contact details on this page. Use the map link for directions.',
    'Use the enquiry form for a general question and include a way for the team to reply. For a materials list or quantities, use the bulk quote form.',
  ]],
  '/info/services':['Asking about a service',[
    'Review the services on this page and find the one closest to your project.',
    'When requesting a quote, include your location, an outline of the work, the timeline and any relevant plans or specifications.',
  ]],
  '/info/projects':['Exploring previous projects',[
    'Browse the project examples for an idea of the work VC’s has completed.',
    'Mention a relevant example when enquiring about your own project and include the location and project scope.',
  ]],
  '/info/about':['Learning about VC’s',[
    'Read about the depot’s history, electrical supplies and contracting work.',
    'Open Our projects to see examples of completed work or Contact to reach the business directly.',
  ]],
  '/info/shipping':['Arranging delivery or collection',[
    'Add your address and desired date to your quote request so the depot can confirm whether delivery is available.',
    'If you prefer collection, call the depot to confirm timing and product availability before travelling.',
  ]],
  '/info/faq':['Finding answers',[
    'Scan the questions for information about enquiries, bulk quotes and the depot.',
    'Use Contact for a question specific to your project or request.',
  ]],
  '/info/privacy':['Understanding privacy',[
    'Review the information the site collects when you submit an enquiry and how it is used to respond.',
    'Contact the depot for a question about your information or to make a privacy request.',
  ]],
  '/info/terms':['Reviewing website terms',[
    'Read these terms before using the site or requesting a quotation. Confirm final scope, pricing and availability with the depot.',
    'Contact the depot for questions about a specific quotation or arrangement.',
  ]],
  '/admin':['Using the staff portal',[
    'Sign in with your staff email and password. If the owner sent you a one-time setup link, open it and choose your password.',
    'Open the sidebar to find the tools assigned to your account. If a workspace is missing, ask the owner to update your permissions.',
    'The delivery overview counts packages awaiting delivery, in transit, delivered and cancelled. Open Dispatch to check the status, driver and delivery history of a package.',
    'Open the bell for staff notifications and mark them read after reviewing them.',
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
    'Update the selected element and click Apply in preview. Use Restore original to remove a change. Edit shared header and footer content from Home.',
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
  const [heading,steps]=guide[path]||guide[path.startsWith('/product/')?'/product':path.startsWith('/admin')?'/admin':'/'];
  if(!available)return null;
  return <div className="page-help" data-website-ignore>
    <button ref={toggle} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{dialog.current?.showModal();setOpen(true);}}><CircleHelp size={20}/> Help</button>
    <dialog ref={dialog} onClose={()=>{setOpen(false);toggle.current?.focus();}} aria-labelledby="page-help-title">
      <button className="help-close" aria-label="Close help" onClick={()=>dialog.current?.close()}><X size={22}/></button>
      <h2 id="page-help-title">{heading}</h2><ol>{steps.map(step=><li key={step}>{step}</li>)}</ol>
    </dialog>
  </div>;
}
