// Inline markdown for content text fields: HTML escaped, then *em* and **strong** only.
// ponytail: emphasis only; add a real parser if entries start using links or code.

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Emphasis only when the delimiter hugs non-space text, so "2 * 3 * 4" and a lone "*" stay as typed. */
export const inlineMd = (s: string) =>
  escapeHtml(s)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>');
