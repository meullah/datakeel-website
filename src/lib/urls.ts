// Every internal URL is built here, always with a trailing slash (AD-11).
import { siteUrl } from './config.ts';

const path = (...parts: string[]) =>
  '/' + parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/') + (parts.some(Boolean) ? '/' : '');

const slug = (id: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid slug: "${id}"`);
  return id;
};

export const homeUrl = () => '/';
export const whatWeDoUrl = () => path('what-we-do');
export const howWeWorkUrl = () => path('how-we-work');
export const caseStudiesUrl = () => path('case-studies');
export const caseStudyUrl = (id: string) => path('case-studies', slug(id));
export const industryUrl = (id: string) => path('industries', slug(id));
export const standardUrl = () => path('standard');
export const readinessReviewUrl = () => path('readiness-review');
export const readinessReviewSentUrl = () => path('readiness-review', 'sent');
export const selfAssessmentUrl = () => path('self-assessment');
export const guidesUrl = () => path('guides');
export const guideUrl = (id: string) => path('guides', slug(id));
export const aboutUrl = () => path('about');
export const contactUrl = () => path('contact');
export const contactSentUrl = () => path('contact', 'sent');
export const privacyUrl = () => path('privacy');
export const termsUrl = () => path('terms');

/** Absolute URL for canonicals, sitemaps and JSON-LD. */
export const absoluteUrl = (p: string) => siteUrl + (p.startsWith('/') ? p : '/' + p);
export const styleguideUrl = () => path('styleguide');

/** Pages that carry `noindex` and stay out of the sitemap, plus any path ending in /sent/. */
export const noindexPaths: readonly string[] = ['/404/', styleguideUrl()];

/** Tolerates "/404", "/404/" and "/404.html". */
export const isNoindexPath = (p: string) => {
  const n = p.replace(/(\/index)?\.html$/, '').replace(/\/?$/, '/');
  return noindexPaths.includes(n) || n.endsWith('/sent/');
};
