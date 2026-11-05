import {Header,Footer} from '../../components/ui';import {catalog} from '../../lib/catalog';import Shop from './shop';
export const dynamic='force-dynamic';export const metadata={title:'Shop electrical supplies'};
export default async function Page(){return <><Header/><Shop products={await catalog()}/><Footer/></>}
