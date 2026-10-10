import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
export function cn(...values: ClassValue[]) {return twMerge(clsx(values));}
export function normalizeSearch(value: string) {return value.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ـ/g,'').trim().toLocaleLowerCase();}
