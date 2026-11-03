// The only way to read content collections: drafts filtered, one sort, content rules enforced.
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';
import { assertHomepageStats, assertNoMarkers, assertRelated, compareEntries } from './pure/content-rules.ts';

const isPublished = (e: { data: object }) => !('draft' in e.data && e.data.draft === true);

// Runs once per build. Every page renders the header, which calls getIndustries(), so any page build fails on a broken rule.
let checked: Promise<void> | undefined;
async function runChecks() {
  const [cases, industries, services] = await Promise.all([
    getCollection('caseStudies', isPublished),
    getCollection('industries'),
    getCollection('services'),
  ]);
  assertNoMarkers(cases, 'caseStudies');
  assertNoMarkers(industries, 'industries');
  assertNoMarkers(services, 'services');
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
