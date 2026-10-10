import {ArrowUpRight, Camera, Code2, Layers3, TrendingUp} from 'lucide-react';
import type {CourseCover as Cover} from '@/content/catalog';
import {cn} from '@/lib/utils';
const tones={design:'bg-[#f9ecd1]',code:'bg-[#dfedf9]',business:'bg-[#e1f1ed]',photo:'bg-[#ebe8f6]'};
export function CourseCover({cover,className}:{cover:Cover;className?:string}){
  const Icon={design:Layers3,code:Code2,business:TrendingUp,photo:Camera}[cover];
  return <div aria-hidden="true" className={cn('cover-grid relative flex h-52 items-center justify-center overflow-hidden',tones[cover],className)}>
    <div className="absolute size-36 rounded-full border border-navy/10"/>
    <div className="absolute end-7 top-7 size-7 rounded-full bg-white/70"/>
    <div className="relative -rotate-6 rounded-2xl border border-white bg-white p-6 shadow-[12px_12px_0_0_#19243c10]"><Icon className="size-16 stroke-[1.1] text-navy"/></div>
    <div className="absolute bottom-6 start-6 flex gap-1.5"><i className="size-2 rounded-full bg-navy/30"/><i className="size-2 rounded-full bg-navy/20"/><i className="size-2 rounded-full bg-navy/10"/></div>
    <ArrowUpRight className="logical-arrow absolute bottom-5 end-5 size-5 text-navy/60"/>
  </div>;
}
