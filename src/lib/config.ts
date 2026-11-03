// Single home for shared identity and copy (AD-13).
export const companyName = 'DataKeel AI';
// ponytail: wording still to be confirmed by the founder (PRD open item 13).
export const positioningLine =
  'Microsoft Fabric and Databricks lakehouse specialists: we build the data platform first, then the AI on top.';
export const siteUrl = 'https://datakeelai.com';
export const email = 'hello@datakeelai.com';

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
export const sameAs: readonly string[] = [];
