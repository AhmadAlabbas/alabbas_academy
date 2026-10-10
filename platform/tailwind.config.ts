const config = {
  theme: {
    extend: {
      colors: {navy:'#19243c', blue:'#79cae7', gold:'#f2cf8d', canvas:'#f7f8fa', ink:'#19243c', muted:'#657187', line:'#e2e7ee', skysoft:'#e6f5fb', goldsoft:'#fff3dc'},
      fontFamily: {arabic:['var(--font-arabic)','var(--font-latin)','sans-serif'],latin:['var(--font-latin)','sans-serif']},
      fontSize: {hero:['clamp(2.6rem,5.1vw,4.35rem)',{lineHeight:'1.2'}],section:['clamp(1.8rem,3vw,2.5rem)',{lineHeight:'1.45'}],eyebrow:['0.75rem',{lineHeight:'1.8'}]},
      borderRadius: {card:'1.5rem',control:'0.875rem'},
      boxShadow: {card:'0 12px 40px rgb(25 36 60 / 5%)',lift:'0 20px 50px rgb(25 36 60 / 10%)'},
      spacing: {18:'4.5rem',22:'5.5rem'},
    },
  },
};

export default config;
