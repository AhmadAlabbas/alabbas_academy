import localFont from 'next/font/local';
export const arabicFont = localFont({
  variable:'--font-arabic',display:'swap',fallback:['Arial','sans-serif'],
  src:[
    {path:'../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2',weight:'400',style:'normal'},
    {path:'../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2',weight:'500',style:'normal'},
    {path:'../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',weight:'600',style:'normal'},
    {path:'../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2',weight:'700',style:'normal'},
  ],
});
export const latinFont = localFont({
  src:'../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable:'--font-latin',weight:'100 900',display:'swap',fallback:['Arial','sans-serif'],
});
