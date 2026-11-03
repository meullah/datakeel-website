import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cta, email, officialProfiles, officialProfilesFor, positioningLine, sameAs } from '../src/lib/config.ts';
import { industries } from '../src/lib/industries.ts';
import * as u from '../src/lib/urls.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const hasDist = existsSync(dist);
const skip = { skip: hasDist ? false : 'dist/ not found; run npm run build first' };
const htmlFiles = hasDist
  ? (readdirSync(dist, { recursive: true }) as string[])
      .filter((file) => file.endsWith('.html'))
      .map((file) => join(dist, file))
  : [];

type InternalLink = { source: string; href: string };
type LinkFailure = InternalLink & { reason: string };

function internalLinks(html: string, source: string): InternalLink[] {
  return [...html.matchAll(/\bhref="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => ({ source, href }));
}

function targetFor(href: string): { target?: string; reason?: string } {
  let pathname: string;
  try {
    pathname = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  } catch {
    return { reason: 'malformed URL encoding' };
  }
  if (pathname === '/') return { target: join(dist, 'index.html') };
  const local = pathname.replace(/^\/+/, '');
  const target = resolve(dist, pathname.endsWith('/') ? join(local, 'index.html') : local);
  const fromDist = relative(dist, target);
  if (fromDist === '..' || fromDist.startsWith(`..${sep}`) || isAbsolute(fromDist)) {
    return { reason: 'target escapes dist' };
  }
  return { target };
}

function brokenLinks(links: InternalLink[]): LinkFailure[] {
  return links.flatMap((link) => {
    const resolved = targetFor(link.href);
    if (resolved.reason) return [{ ...link, reason: resolved.reason }];
    try {
      if (resolved.target && statSync(resolved.target).isFile()) return [];
    } catch {}
    return [{ ...link, reason: 'target is not a file' }];
  });
}

function assertNoBrokenLinks(links: InternalLink[]): void {
  const broken = brokenLinks(links);
  assert.equal(
    broken.length,
    0,
    `Broken internal links:\n${broken.map(({ source, href, reason }) => `${source}: ${href} (${reason})`).join('\n')}`,
  );
}

const read = (file: string) => readFileSync(file, 'utf8');
const built = (path: string) => readFileSync(path === u.notFoundUrl() ? join(dist, '404.html') : join(dist, path, 'index.html'), 'utf8');
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const htmlText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const mainOf = (html: string, source: string) => {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
  assert.ok(main, `${source}: no main`);
  return main;
};
const closingCtas = (main: string) => [...main.matchAll(/<section\b[^>]*data-closing-cta="[^"]+"[\s\S]*?<\/section>/g)].map((match) => match[0]);

test('every internal link in built HTML resolves', skip, () => {
  const links = htmlFiles.flatMap((file) => internalLinks(read(file), relative(dist, file)));
  assert.ok(links.length > 0, 'no internal links found');
  assertNoBrokenLinks(links);
});

test('broken link failures list the source page and href', skip, () => {
  assert.throws(
    () => assertNoBrokenLinks([{ source: 'example/index.html', href: '/route-that-does-not-exist/' }]),
    /example\/index\.html: \/route-that-does-not-exist\//,
  );
});

test('link resolution rejects directories, traversal and malformed encoding with source context', skip, () => {
  for (const link of [
    { source: 'directory.html', href: '/about' },
    { source: 'traversal.html', href: '/..%2F..%2Fpackage.json' },
    { source: 'encoding.html', href: '/%E0%A4%A/' },
  ]) {
    assert.throws(() => assertNoBrokenLinks([link]), new RegExp(`${escapeRe(link.source)}: ${escapeRe(link.href)}`));
  }
  assert.doesNotThrow(() => assertNoBrokenLinks([{ source: 'valid.html', href: '/about/#team' }]));
});

test('every built page except 404 ends main with exactly one closing CTA', skip, () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const source = relative(dist, file);
    const main = mainOf(html, source);
    const ctas = closingCtas(main);
    if (basename(file) === '404.html') {
      assert.equal(ctas.length, 0, source);
      continue;
    }
    assert.equal(ctas.length, 1, `${source}: closing CTA count`);
    assert.ok(main.trimEnd().endsWith(ctas[0]), `${source}: CTA is not last in main`);
  }
  const laterSection = '<section data-closing-cta="default"></section><section></section>';
  assert.ok(!laterSection.endsWith(closingCtas(laterSection)[0]), 'a later section must fail the CTA-last check');
});

test('closing CTA variants render the required links and primary behavior', skip, () => {
  const review = built(u.readinessReviewUrl());
  const reviewCta = review.match(/<section\b[^>]*data-closing-cta="review"[\s\S]*?<\/section>/)?.[0];
  assert.ok(reviewCta, 'review: no closing CTA');
  assert.match(reviewCta, />Not ready for a review yet\?</);
  assert.match(reviewCta, new RegExp(`href="${escapeRe(u.contactUrl())}"[^>]*>Talk to us<`));
  assert.match(reviewCta, new RegExp(`href="${escapeRe(u.selfAssessmentUrl())}"[^>]*>Take the Self-Assessment<`));
  assert.doesNotMatch(reviewCta, /btn-primary/);

  const snapshot = built(u.selfAssessmentUrl());
  const snapshotCta = snapshot.match(/<section\b[^>]*data-closing-cta="snapshot"[\s\S]*?<\/section>/)?.[0];
  assert.ok(snapshotCta, 'snapshot: no closing CTA');
  assert.match(snapshotCta, new RegExp(`href="${escapeRe(u.contactUrl())}"[^>]*>Talk to us<`));
  assert.match(snapshotCta, new RegExp(`href="${escapeRe(u.guidesUrl())}"[^>]*>Read the Guides<`));
  assert.doesNotMatch(snapshotCta, /btn-primary/);

  for (const file of htmlFiles.filter((file) => basename(file) !== '404.html')) {
    const html = read(file);
    if (/data-closing-cta="default"/.test(html)) {
      const [defaultCta] = closingCtas(mainOf(html, relative(dist, file)));
      assert.match(defaultCta, />Ready to see where your data stands\?</);
      assert.equal((defaultCta.match(/btn-primary/g) ?? []).length, 1, relative(dist, file));
      assert.match(defaultCta, new RegExp(`class="[^"]*btn-primary[^"]*" href="${escapeRe(u.readinessReviewUrl())}"[^>]*>${escapeRe(htmlText(cta.primary))}<`));
      assert.match(defaultCta, new RegExp(`href="${escapeRe(u.contactUrl())}"[^>]*>${escapeRe(cta.secondary)}<`));
    }
  }
});

test('footer covers every required destination and follows configured profile state', skip, () => {
  assert.deepEqual(officialProfilesFor(''), []);
  assert.deepEqual(officialProfilesFor('https://www.linkedin.com/company/datakeel-ai/'), [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/datakeel-ai/' },
  ]);
  assert.deepEqual(sameAs, officialProfiles.map((profile) => profile.href));
  const html = built(u.homeUrl());
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer, 'no footer');
  const required = [
    u.whatWeDoUrl(), u.howWeWorkUrl(), u.caseStudiesUrl(),
    ...industries.map((industry) => u.industryUrl(industry.id)),
    u.guidesUrl(), u.standardUrl(), u.readinessReviewUrl(), u.selfAssessmentUrl(),
    u.aboutUrl(), u.contactUrl(), u.privacyUrl(), u.termsUrl(),
  ];
  for (const href of required) assert.match(footer, new RegExp(`href="${escapeRe(href)}"`), href);
  assert.match(footer, new RegExp(`href="mailto:${escapeRe(email)}"[^>]*>${escapeRe(email)}<`));
  assert.match(footer, new RegExp(escapeRe(positioningLine)));
  if (officialProfiles.length) {
    for (const profile of officialProfiles) assert.match(footer, new RegExp(`href="${escapeRe(profile.href)}"[^>]*>${profile.label}<`));
  } else {
    assert.doesNotMatch(footer, />LinkedIn</);
  }
});

test('custom 404 is noindex and links to four helpful pages', skip, () => {
  const html = built(u.notFoundUrl());
  const main = mainOf(html, '404.html');
  const helpful = main.match(/<nav\b[^>]*aria-label="Helpful pages"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(helpful, '404: no helpful pages');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.match(main, /<h1[^>]*>We couldn't find that page\.<\/h1>/);
  assert.match(main, />The link may be out of date, but these pages can help you find your way\.<\/p>/);
  for (const href of [u.homeUrl(), u.caseStudiesUrl(), u.readinessReviewUrl(), u.selfAssessmentUrl()]) {
    assert.match(helpful, new RegExp(`href="${escapeRe(href)}"`), href);
  }
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)?.[1] ?? '{}');
  const breadcrumbs = graph['@graph']?.find((node: { '@type': string }) => node['@type'] === 'BreadcrumbList');
  assert.deepEqual(
    breadcrumbs?.itemListElement.map((item: { name: string; item: string }) => [item.name, item.item]),
    [['Home', u.absoluteUrl('/')], ['404', u.absoluteUrl(u.notFoundUrl())]],
  );
});
