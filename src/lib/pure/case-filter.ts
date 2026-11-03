// Case filter helpers with no DOM, so node --test can run them.

/** The `?industry=` id if it names a known industry, else null (All). */
export function parseIndustry(search: string, ids: readonly string[]): string | null {
  const id = new URLSearchParams(search).get('industry');
  return id !== null && ids.includes(id) ? id : null;
}

/** The live-region text for n visible cards. */
export const countLabel = (n: number) => `Showing ${n} case ${n === 1 ? 'study' : 'studies'}`;
