/**
 * Where company logos come from.
 *
 * Every logo in the app pointed at logo.clearbit.com, which is dead — it returns
 * nothing at all now, for any domain. Clearbit's free logo API was sunset after
 * the HubSpot acquisition, so this was not a URL-building bug but a dependency
 * that had simply stopped existing. Google's favicon service answers 200 for
 * every domain tested, including the awkward ones (riotgames.com, figma.com).
 *
 * Kept in one place so the next time a provider disappears it is one edit.
 */
export function logoUrl(domain: string, size: 64 | 128 = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
