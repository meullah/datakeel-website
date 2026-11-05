// robots.txt (Story 8.2): search and AI crawlers named and allowed, sitemap linked.
import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/urls.ts';

export const crawlers = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export const GET: APIRoute = () =>
  new Response(
    [...crawlers.map((bot) => `User-agent: ${bot}\nAllow: /\n`), 'User-agent: *\nAllow: /\n', `Sitemap: ${absoluteUrl('/sitemap-index.xml')}\n`].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
