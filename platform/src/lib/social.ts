export const socialPlatforms = [
  {key: 'instagram', name: 'Instagram'},
  {key: 'x', name: 'X'},
  {key: 'youtube', name: 'YouTube'},
  {key: 'linkedin', name: 'LinkedIn'},
] as const;
export type SocialPlatform = typeof socialPlatforms[number]['key'];

export function socialLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}
