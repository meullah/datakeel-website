// Content rules with no Astro imports, so node --test can run them.

/** Editorial markers that must never reach a published entry: [confirm…], [ASSUMPTION…], [NOTE…]. */
export const MARKER = /\[(?:confirm|ASSUMPTION|NOTE)\b[^\]]*\]/i;

/** Dotted paths (e.g. "after.2") of every string under `value` that holds a marker. */
export function findMarkers(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return MARKER.test(value) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findMarkers(v, path ? `${path}.${i}` : String(i)));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).flatMap(([k, v]) => findMarkers(v, path ? `${path}.${k}` : k));
  }
  return [];
}

type Entry = { id: string; data: Record<string, unknown>; body?: string };

/** Throws naming the entry and field of the first marker found. */
export function assertNoMarkers(entries: Entry[], collection: string): void {
  for (const e of entries) {
    const hits = [...findMarkers(e.data), ...(e.body && MARKER.test(e.body) ? ['body'] : [])];
    if (hits.length) throw new Error(`${collection}/${e.id}: editorial marker in published field(s) ${hits.join(', ')}. Confirm with the founder, remove the line, or set draft: true.`);
  }
}

type StatsEntry = { id: string; data: { stats?: { homepage?: boolean }[] } };

/** Homepage proof stats: 3-4 in total, drawn from at least 2 case studies. */
export function assertHomepageStats(entries: StatsEntry[]): void {
  const sources = entries.filter((e) => e.data.stats?.some((s) => s.homepage));
  const count = sources.reduce((n, e) => n + e.data.stats!.filter((s) => s.homepage).length, 0);
  if (count < 3 || count > 4) throw new Error(`Homepage stats: found ${count}, need 3 to 4 (stats with homepage: true across published case studies).`);
  if (sources.length < 2) throw new Error(`Homepage stats: all come from ${sources.map((e) => e.id).join(', ') || 'no case study'}; they must come from at least 2 case studies.`);
}

type CaseRefEntry = { id: string; data: { caseStudy: { id: string } } };

/** Each entry's caseStudy must be a published case study (e.g. services, departments). */
export function assertCaseRefs(entries: CaseRefEntry[], caseIds: Set<string>, collection: string): void {
  for (const e of entries)
    if (!caseIds.has(e.data.caseStudy.id)) throw new Error(`${collection}/${e.id}: caseStudy "${e.data.caseStudy.id}" is not a published case study.`);
}

type RelatedEntry = { id: string; data: { related?: ({ id: string } | string)[] } };

/** Related case studies must be other published entries (drafts have no page, so a link would 404). */
export function assertRelated(entries: RelatedEntry[]): void {
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries)
    for (const r of e.data.related ?? []) {
      const id = typeof r === 'string' ? r : r.id;
      if (id === e.id) throw new Error(`caseStudies/${e.id}: related lists itself.`);
      if (!ids.has(id)) throw new Error(`caseStudies/${e.id}: related "${id}" is not a published case study.`);
    }
}

type SortEntry = { id: string; data: { order?: number; featured?: number; published?: Date } };

/** The one sort: order, then featured order (unfeatured last), then published date (newest first), then id. */
export function compareEntries(a: SortEntry, b: SortEntry): number {
  const last = Number.MAX_SAFE_INTEGER;
  return (
    (a.data.order ?? 0) - (b.data.order ?? 0) ||
    (a.data.featured ?? last) - (b.data.featured ?? last) ||
    (b.data.published?.getTime() ?? 0) - (a.data.published?.getTime() ?? 0) ||
    a.id.localeCompare(b.id)
  );
}
