import {Suspense,type ReactNode} from 'react';
import PageHelp from '../../components/page-help';
import Admin,{StaffPortalLoading} from './admin';

export const metadata={robots:{index:false,follow:false}};

export default function AdminLayout({children}:{children:ReactNode}) {
  return <>
    <Suspense fallback={<StaffPortalLoading/>}><Admin>{children}</Admin></Suspense>
    <PageHelp/>
  </>;
}
