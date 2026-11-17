import type {ReactNode} from 'react';
import PageHelp from '../../components/page-help';

export default function AdminLayout({children}:{children:ReactNode}) {
  return <>{children}<PageHelp/></>;
}
