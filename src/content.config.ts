// Content collections (AD: industries and services are the only lists of those names).
// Read entries only through getPublished() in src/lib/content.ts.
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const text = z.string().trim().min(1);

const industries = defineCollection({
  loader: file('src/content/industries.json'),
  schema: z.strictObject({
    id: z.string(), // file() keeps the id in data
    order: z.number().int(),
    name: text,
    // Page copy; Story 3.5 rewrites these.
    h1: text,
    title: text,
    description: text,
    summary: text,
  }),
});

const services = defineCollection({
  loader: file('src/content/services.json'),
  schema: z.strictObject({ id: z.string(), order: z.number().int(), name: text }),
});

const stat = z.strictObject({
  value: z.number().nullable(),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  display: text,
  label: text,
  homepage: z.boolean().default(false),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/caseStudies' }),
  schema: z.strictObject({
    headline: text,
    subtitle: text,
    industry: reference('industries'),
    service: reference('services'),
    /** The content file's service label, shown verbatim. */
    serviceLabel: text,
    framingLabel: z.enum(["Our team's experience", 'Proof of concept']).optional(),
    client: text.optional(),
    before: text,
    built: text,
    found: text,
    after: z.array(text).min(1),
    stack: z.array(text).min(1),
    visual: z.strictObject({ kind: z.enum(['diagram', 'dashboard']), id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) }).optional(),
    seoTitle: text.max(60),
    cardLine: text,
    cardSummary: text,
    metaDescription: text.max(155),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    draft: z.boolean(),
    /** Featured order (lower first); absent = not featured. */
    featured: z.number().int().positive().optional(),
    related: z.array(reference('caseStudies')).max(2).optional(),
    stats: z.array(stat).optional(),
  }),
});

export const collections = { caseStudies, industries, services };
