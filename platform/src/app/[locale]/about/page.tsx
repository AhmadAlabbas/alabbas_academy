import Page,{generateMetadata as staticMetadata} from '../[page]/page';
import type {Locale} from '@/i18n/routing';
export const generateMetadata=({params}:{params:Promise<{locale:Locale}>})=>staticMetadata({params:params.then(p=>({...p,page:'about'}))});
export default function About({params}:{params:Promise<{locale:string}>}){return Page({params:params.then(p=>({...p,page:'about'}))});}
