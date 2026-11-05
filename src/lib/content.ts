// The only way to read content collections: drafts filtered, one sort, content rules enforced.
import { getCollection, getEntry, type CollectionEntry, type CollectionKey } from 'astro:content';
import { assertCaseRefs, assertHomepageStats, assertNoMarkers, assertRelated, compareEntries } from './pure/content-rules.ts';

const isPublished = (e: { data: object }) => !('draft' in e.data && e.data.draft === true);

// Runs once per build. Every page renders the header, which calls getIndustries(), so any page build fails on a broken rule.
let checked: Promise<void> | undefined;
async function runChecks() {
  const [cases, industries, services, faqs, departments, pages] = await Promise.all([
    getCollection('caseStudies', isPublished),
    getCollection('industries'),
    getCollection('services'),
    getCollection('faqs'),
    getCollection('departments'),
    getCollection('pages'),
  ]);
  assertNoMarkers(cases, 'caseStudies');
  assertNoMarkers(industries, 'industries');
  assertNoMarkers(services, 'services');
  assertNoMarkers(faqs, 'faqs');
  assertNoMarkers(departments, 'departments');
  assertNoMarkers(pages, 'pages');
  const caseIds = new Set(cases.map((c) => c.id));
  assertCaseRefs(services, caseIds, 'services');
  assertCaseRefs(departments.filter((d) => d.data.show), caseIds, 'departments');
  assertHomepageStats(cases);
  assertRelated(cases);
}
const checkContent = () => {
  // Dev server: content changes between requests, so re-check every time (and never keep a stale failure).
  if (import.meta.env.DEV) return runChecks();
  return (checked ??= runChecks());
};

export async function getPublished<C extends CollectionKey>(collection: C): Promise<CollectionEntry<C>[]> {
  await checkContent();
  const entries = await getCollection(collection, isPublished);
  return entries.sort(compareEntries as (a: CollectionEntry<C>, b: CollectionEntry<C>) => number);
}

export const getIndustries = () => getPublished('industries');

/** FAQ items for a page key (the route slug, e.g. 'readiness-review'); a missing file fails the build. */
export async function getFaqs(pageKey: string) {
  await checkContent();
  const entry = await getEntry('faqs', pageKey);
  if (!entry) throw new Error(`faqs: no src/content/faqs/${pageKey}.json`);
  return entry.data.items;
}

/** Page copy for a route slug (e.g. 'what-we-do'); a missing entry fails the build. */
export async function getPage(id: string) {
  await checkContent();
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`pages: no entry "${id}" in src/content/pages.json`);
  return entry.data;
}

/** A page's section by id; a missing one fails the build. */
export function sectionOf(page: CollectionEntry<'pages'>['data'], id: string) {
  const s = page.sections.find((x) => x.id === id);
  if (!s) throw new Error(`pages/${page.id}: section "${id}" missing`);
  return s;
}
