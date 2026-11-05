// llms.txt (Story 8.2): every published page and entry with its one-line summary, for AI assistants.
// Content pages come from the pages collection (`summary`); entries from getPublished().
import type { APIRoute } from 'astro';
import { companyName, email, positioningLine } from '../lib/config.ts';
import { getPage, getPublished } from '../lib/content.ts';
import * as u from '../lib/urls.ts';

const line = (name: string, path: string, summary: string) => `- [${name}](${u.absoluteUrl(path)}): ${summary}`;

export const GET: APIRoute = async () => {
  const [cases, industries, guides, services] = await Promise.all([
    getPublished('caseStudies'),
    getPublished('industries'),
    getPublished('guides'),
    getPublished('services'),
  ]);
  const page = async (id: string, path: string) => {
    const p = await getPage(id);
    return line(p.h1, path, p.summary);
  };
  // ponytail: routes without a pages entry carry their summary here; move them into pages.json if they grow copy.
  const body = [
    `# ${companyName}`,
    '',
    `> ${positioningLine}`,
    '',
    'We design, build and run modern data platforms on Microsoft Fabric and Databricks, then build AI on top. Every engagement starts with a fixed-price Data & AI Readiness Review.',
    '',
    '## Pages',
    line('Home', u.homeUrl(), positioningLine),
    await page('what-we-do', u.whatWeDoUrl()),
    await page('how-we-work', u.howWeWorkUrl()),
    await page('standard', u.standardUrl()),
    line('Data & AI Readiness Review', u.readinessReviewUrl(), 'A fixed-price review of your data: in about 10 working days you get a written plan, and you decide if we’re the right fit.'),
    line('Self-Assessment: Where does your week go?', u.selfAssessmentUrl(), 'Five quick questions about how your team works with data, with a rough snapshot at the end. No email needed.'),
    line('Case studies', u.caseStudiesUrl(), 'Data platform and AI work in healthcare, insurance, automotive and finance: what was wrong, what was built and what changed.'),
    line('Guides', u.guidesUrl(), 'Plain-English answers to the questions people ask before they invest in data and AI.'),
    await page('about', u.aboutUrl()),
    line('Contact', u.contactUrl(), `Send us a message, or email ${email}.`),
    await page('privacy', u.privacyUrl()),
    await page('terms', u.termsUrl()),
    '',
    '## Services',
    ...services.map((s) => line(s.data.name, `${u.whatWeDoUrl()}#${s.id}`, s.data.summary)),
    '',
    '## Case studies',
    ...cases.map((c) => line(c.data.framingLabel ? `${c.data.headline} (${c.data.framingLabel})` : c.data.headline, u.caseStudyUrl(c.id), c.data.cardSummary)),
    '',
    '## Industries',
    ...industries.map((i) => line(i.data.name, u.industryUrl(i.id), i.data.description)),
    '',
    '## Guides',
    ...guides.map((g) => line(g.data.title, u.guideUrl(g.id), g.data.summary)),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
