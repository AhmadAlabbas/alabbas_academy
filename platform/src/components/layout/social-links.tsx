import {socialLink, socialPlatforms, type SocialPlatform} from '@/lib/social';

function SocialIcon({platform}: {platform: SocialPlatform}) {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {platform === 'instagram' && <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></>}
    {platform === 'x' && <path stroke="none" fill="currentColor" d="M18.9 3h2.7l-6.5 7.4L22.7 21h-6l-4.7-6.2L6.6 21H3.9l6.8-7.8L3.3 3h6.1l4.2 5.7L18.9 3Zm-.9 16h1.5L8.6 4.9H7L18 19Z"/>}
    {platform === 'youtube' && <><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none"/></>}
    {platform === 'linkedin' && <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 10v7M11.5 17v-7m0 3a3 3 0 0 1 6 0v4"/><circle cx="7.5" cy="7" r=".9" fill="currentColor" stroke="none"/></>}
  </svg>;
}

export function SocialLinks({settings, heading, comingSoon}: {settings: Record<string, unknown>; heading: string; comingSoon: string}) {
  return <div className="mt-6">
    <p className="text-sm font-semibold text-ink">{heading}</p>
    <ul className="mt-3 flex flex-wrap gap-3" aria-label={heading}>
      {socialPlatforms.map(({key, name}) => {
        const href = socialLink(settings[key]);
        const className = 'inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink';
        return <li key={key}>{href ?
          <a className={`${className} transition hover:border-blue hover:bg-skysoft`} href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}><SocialIcon platform={key}/></a> :
          <span className={`${className} opacity-55`} role="img" aria-label={`${name} — ${comingSoon}`} title={`${name} — ${comingSoon}`}><SocialIcon platform={key}/></span>
        }</li>;
      })}
    </ul>
  </div>;
}
