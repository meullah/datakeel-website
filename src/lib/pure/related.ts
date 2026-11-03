// Related case studies, no Astro imports so node --test can run it.

type Ref = { id: string } | string;
export type RelatedEntry = { id: string; data: { industry: Ref; related?: Ref[] } };

const refId = (r: Ref) => (typeof r === 'string' ? r : r.id);

/**
 * Up to `count` related cases: the explicit `related` list first, then same-industry cases, then any other case.
 * `all` is the published list in getPublished() order, so drafts never appear and fallbacks follow the one sort.
 */
export function pickRelated<E extends RelatedEntry>(current: E, all: E[], count = 2): E[] {
  const others = all.filter((e) => e.id !== current.id);
  const industry = refId(current.data.industry);
  const explicit = (current.data.related ?? []).map((r) => others.find((e) => e.id === refId(r))).filter((e): e is E => !!e);
  const sameIndustry = others.filter((e) => refId(e.data.industry) === industry);
  return [...new Set([...explicit, ...sameIndustry, ...others])].slice(0, count);
}
