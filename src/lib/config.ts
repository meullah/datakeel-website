// Single home for shared identity and copy (AD-13).
export const companyName = 'DataKeel AI';
// Founder-confirmed 2026-11-04.
export const positioningLine =
  'We build the data platform your business runs on, then the AI that makes it useful.';
export const siteUrl = 'https://datakeelai.com';
export const email = 'hello@datakeelai.com';
// Web3Forms public access key (safe in client code). Temporary: delivers to the founder's personal inbox until
// hello@datakeelai.com is live; swap for a key tied to hello@ before launch (deferred-work.md).
export const web3formsKey = 'df4be7b4-9a4c-4661-943f-16b0bc963d67';
// Cloudflare Web Analytics site token (public; cookieless, no consent banner). Empty = no beacon. The founder adds it
// in Epic 9 after creating the site in Cloudflare. The beacon loads only in production builds served on this host.
export const cloudflareAnalyticsToken = '';
export const analyticsHost = 'datakeelai.com';
// Where both forms post; a later CRM swap changes only this.
export const formEndpoint = 'https://api.web3forms.com/submit';
// Email subject per form, so the two lead types are easy to tell apart in the inbox.
export const formSubjects = {
  'readiness-review': 'New Readiness Review request',
  contact: 'New contact message',
} as const;
// Placeholders: the founder will supply both URLs (deferred-work.md). An empty URL hides its footer link and sameAs entry.
export const profileUrls = { LinkedIn: '', Upwork: '' };
export const officialProfilesFor = (urls: Record<string, string>) =>
  Object.entries(urls).filter(([, href]) => href).map(([label, href]) => ({ label, href }));
export const officialProfiles = officialProfilesFor(profileUrls);

export const cta = {
  primary: 'Request a Data & AI Readiness Review',
  primaryShort: 'Request a review',
  secondary: 'Talk to us',
} as const;

/** Default social share image (served from public/). */
export const defaultOgImage = '/png/social-avatar-400.png';
// ponytail: mirror --color-background (light, dark) in tokens.css; tests/seo.test.ts guards the copies.
export const themeColor = '#F6F6F3';
export const themeColorDark = '#0F1115';

/** Official profiles for Organization.sameAs; empty until the founder confirms them. */
export const sameAs: readonly string[] = officialProfiles.map((profile) => profile.href);
