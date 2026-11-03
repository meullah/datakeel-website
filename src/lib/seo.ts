// The single SEO path (AD-4, AD-12): titles, descriptions and the JSON-LD @graph.
// Pure functions; any guard failure throws so the build fails.
import { companyName, email, positioningLine, sameAs, siteUrl } from './config.ts';
import { absoluteUrl, homeUrl } from './urls.ts';

export const TITLE_SUFFIX = ` | ${companyName}`;
export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;

export type Crumb = { name: string; url: string };
export type GraphNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${siteUrl}/#organization`;
export const WEBSITE_ID = `${siteUrl}/#website`;
export const webPageId = (path: string) => `${absoluteUrl(path)}#webpage`;
export const breadcrumbId = (path: string) => `${absoluteUrl(path)}#breadcrumb`;

const isBlank = (s: string | undefined) => !s?.trim();

export function assertTitle(full: string | undefined, page: string): string {
  if (isBlank(full)) throw new Error(`[seo] ${page}: title is missing or blank`);
  if (full!.length > MAX_TITLE)
    throw new Error(`[seo] ${page}: title "${full}" is ${full!.length} chars (max ${MAX_TITLE})`);
  return full!;
}

/** Bare page title plus the company suffix, guarded at 60 chars. */
export function fullTitle(title: string | undefined, page: string): string {
  if (isBlank(title)) throw new Error(`[seo] ${page}: title is missing or blank`);
  return assertTitle(title + TITLE_SUFFIX, page);
}

export function assertDescription(description: string | undefined, page: string): string {
  if (isBlank(description)) throw new Error(`[seo] ${page}: description is missing or blank`);
  if (description!.length > MAX_DESCRIPTION)
    throw new Error(`[seo] ${page}: description is ${description!.length} chars (max ${MAX_DESCRIPTION})`);
  return description!;
}

export const organizationNode = (): GraphNode => ({
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: companyName,
  url: absoluteUrl(homeUrl()),
  email,
  description: positioningLine,
  logo: absoluteUrl('/png/icon-512.png'),
  ...(sameAs.length ? { sameAs: [...sameAs] } : {}),
});

export const websiteNode = (): GraphNode => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: companyName,
  url: absoluteUrl(homeUrl()),
  publisher: { '@id': ORGANIZATION_ID },
});

/** Crumbs exclude Home; it is always prepended. */
export const breadcrumbNode = (crumbs: Crumb[], path: string): GraphNode => ({
  '@type': 'BreadcrumbList',
  '@id': breadcrumbId(path),
  itemListElement: [{ name: 'Home', url: homeUrl() }, ...crumbs].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: absoluteUrl(c.url),
  })),
});

export function assertCrumbs(crumbs: Crumb[], path: string): Crumb[] {
  for (const c of crumbs) {
    if (isBlank(c.name)) throw new Error(`[seo] ${path}: breadcrumb with a blank name`);
    if (!/^\/(?!\/)(.*\/)?$/.test(c.url))
      throw new Error(`[seo] ${path}: breadcrumb url "${c.url}" must be an internal path starting and ending with /`);
  }
  const last = crumbs.at(-1);
  if (last && last.url !== path)
    throw new Error(`[seo] ${path}: last breadcrumb url "${last.url}" must be the current path`);
  return crumbs;
}

export type PageSeo = {
  path: string;
  title: string;
  description: string;
  breadcrumbs?: Crumb[];
  noindex?: boolean;
  extraNodes?: GraphNode[];
};

/** Breadcrumbs are required on every indexable page except Home. */
export function buildGraph({ path, title, description, breadcrumbs, noindex = false, extraNodes = [] }: PageSeo) {
  const hasCrumbs = !!breadcrumbs?.length;
  if (!hasCrumbs && path !== homeUrl() && !noindex) throw new Error(`[seo] ${path}: missing breadcrumbs prop`);
  if (hasCrumbs) assertCrumbs(breadcrumbs!, path);
  const webPage: GraphNode = {
    '@type': 'WebPage',
    '@id': webPageId(path),
    url: absoluteUrl(path),
    name: title,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(hasCrumbs ? { breadcrumb: { '@id': breadcrumbId(path) } } : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      websiteNode(),
      webPage,
      ...(hasCrumbs ? [breadcrumbNode(breadcrumbs!, path)] : []),
      ...extraNodes,
    ],
  };
}

/** JSON for an inline script; `<` is escaped so content can never close the tag. */
export const serializeGraph = (graph: object) => JSON.stringify(graph).replace(/</g, '\\u003c');
