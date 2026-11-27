import type {Metadata} from 'next';
import './globals.css';
import './operations.css';
import WebsiteContent from '../components/website-content';
import {company} from '../lib/company';
import {publicPages,siteOrigin} from '../lib/seo';

export const metadata:Metadata = {
  metadataBase:new URL(siteOrigin),
  title:{default:company.displayName,template:'%s | '+company.displayName},
  description:publicPages.home.description,
  verification:process.env.GOOGLE_SITE_VERIFICATION ? {google:process.env.GOOGLE_SITE_VERIFICATION} : undefined,
  icons:{
    icon:[{url:'/favicon.ico'},{url:'/favicon-48.png',sizes:'48x48',type:'image/png'}],
    apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}],
    shortcut:'/favicon.ico',
  },
  manifest:'/site.webmanifest',
};

export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en-JM"><body>{children}<WebsiteContent/></body></html>;
}
