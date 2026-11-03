// Collection data for node tests (astro:content can't load outside Astro). Same order as getPublished().
import { readdirSync, readFileSync } from 'node:fs';
import { compareEntries } from '../src/lib/pure/content-rules.ts';

type Industry = { id: string; order: number; name: string; h1: string; title: string; description: string; intro: string; problems: string[]; reviewed: boolean };

export const industries: Industry[] = JSON.parse(readFileSync(new URL('../src/content/industries.json', import.meta.url), 'utf8'))
  .sort((a: Industry, b: Industry) => compareEntries({ id: a.id, data: a }, { id: b.id, data: b }));

const caseDir = new URL('../src/content/caseStudies/', import.meta.url);
/** Ids of published case studies (draft: false). */
export const caseStudyIds: string[] = readdirSync(caseDir)
  .filter((f) => f.endsWith('.md') && !/^draft:\s*true\s*$/m.test(readFileSync(new URL(f, caseDir), 'utf8')))
  .map((f) => f.slice(0, -3))
  .sort();
