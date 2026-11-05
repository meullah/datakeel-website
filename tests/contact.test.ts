// Story 4.3: built /contact/ page and the two /sent/ confirmation pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cta, email } from '../src/lib/config.ts';
import { successCopy, type FormVariant } from '../src/lib/pure/constants.ts';
import { absoluteUrl, contactSentUrl, contactUrl, readinessReviewSentUrl } from '../src/lib/urls.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };
const read = (r: string) => readFileSync(join(dist, r, 'index.html'), 'utf8');
const mainOf = (h: string) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const h1s = (h: string) => [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));

test('contact page: one h1, mailto, contact form in #message with the right fields, contact closing band', skip, () => {
  const h = read(contactUrl());
  const main = mainOf(h);
  assert.deepEqual(h1s(h), ['Talk to us']);
  assert.match(main, new RegExp(`<a href="mailto:${escapeRe(email)}"[^>]*>${escapeRe(email)}</a>`), 'mailto link');
  const section = main.match(/<section[^>]*id="message"[\s\S]*?<\/section>/)![0];
  assert.equal(text(section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)![1]), 'Send us a message');
  const form = section.match(/<form[^>]*data-form="contact"[\s\S]*?<\/form>/)![0];
  for (const f of ['name', 'email', 'company', 'country', 'message']) assert.match(form, new RegExp(`name="${f}"`), f);
  for (const f of ['role', 'companySize']) assert.doesNotMatch(form, new RegExp(`name="${f}"`), f);
  assert.ok(form.includes(`name="redirect" value="${absoluteUrl(contactSentUrl())}"`), 'no-JS redirect');
  assert.match(form, /<button[^>]*type="submit"[^>]*>\s*Send message\s*</);
  const band = main.match(/data-closing-cta="contact"[\s\S]*$/)![0];
  assert.match(band, /Ready to see where your data stands\?/);
  assert.match(decode(band), new RegExp(`class="btn btn-primary" href="/readiness-review/"[^>]*>${escapeRe(cta.primary)}</a>`));
  assert.ok(!band.includes(`>${cta.secondary}<`), 'no self-link');
});

const sent: [FormVariant, string][] = [
  ['readiness-review', readinessReviewSentUrl()],
  ['contact', contactSentUrl()],
];
for (const [variant, route] of sent) {
  test(`${route}: exists, noindex, h1 = successCopy heading, label, ghost links`, skip, () => {
    const h = read(route);
    const main = mainOf(h);
    const copy = successCopy[variant];
    assert.match(h, /<meta name="robots" content="noindex/);
    assert.deepEqual(h1s(h), [copy.heading('')]);
    assert.ok(main.includes(`>${copy.label}</p>`), copy.label);
    assert.equal(main.includes(`mailto:${email}`), variant === 'readiness-review', 'mailto only on the request page');
    assert.match(main, /<a class="btn btn-ghost" href="\/"[^>]*>Back to home<\/a>/);
    assert.match(main, /<a class="btn btn-ghost" href="\/case-studies\/"[^>]*>Read the case studies<\/a>/);
  });
}

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

test('sent pages are not in the sitemap', skip, () => {
  const xml = readdirSync(dist).filter((f) => /^sitemap-.*\.xml$/.test(f)).map((f) => readFileSync(join(dist, f), 'utf8')).join('');
  assert.ok(xml.includes(absoluteUrl(contactUrl())), 'sanity: contact is listed');
  assert.doesNotMatch(xml, /\/sent\//);
});

test(`every "${cta.secondary}" link points to the contact page`, skip, () => {
  let count = 0;
  // The styleguide's button demos use href="#"; it is a noindex internal page.
  for (const file of htmlFiles(dist).filter((f) => !f.includes('styleguide'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      if (text(m[2]) !== cta.secondary) continue;
      count++;
      assert.equal(m[1].match(/href="([^"]*)"/)?.[1], contactUrl(), file);
    }
  }
  assert.ok(count > 0);
});
