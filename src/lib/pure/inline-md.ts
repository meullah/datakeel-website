// Inline markdown for content text fields: HTML escaped, then *em*, **strong** and [text](/internal/path/) links only.
// ponytail: no external links or code; add a real parser if entries need them.

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Internal links only: the path starts with one "/" (never "//host" or "/\host", which browsers read as off-site). */
const LINK = /\[([^\]]+)\]\((\/(?![\/\\])[^)\s]*)\)/g;

/** Emphasis only when the delimiter hugs non-space text, so "2 * 3 * 4" and a lone "*" stay as typed. */
export const inlineMd = (s: string) =>
  escapeHtml(s)
    .replace(LINK, '<a href="$2">$1</a>')
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>');

/** Plain text for JSON-LD and meta: links keep their text, emphasis markers drop. */
export const plainMd = (s: string) =>
  s.replace(LINK, '$1').replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1').replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '$1');
