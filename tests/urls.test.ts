import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as urls from '../src/lib/urls.ts';

test('internal URLs always end with a slash', () => {
  assert.equal(urls.homeUrl(), '/');
  assert.equal(urls.caseStudyUrl('auto-dealer-inventory'), '/case-studies/auto-dealer-inventory/');
  assert.equal(urls.contactSentUrl(), '/contact/sent/');
  assert.equal(urls.absoluteUrl('/about/'), 'https://datakeelai.com/about/');
  for (const p of urls.noindexPaths) assert.match(p, /^\/.*\/$/);
  for (const [name, fn] of Object.entries(urls)) {
    if (name === 'absoluteUrl' || name === 'isNoindexPath' || typeof fn !== 'function') continue;
    assert.match((fn as (id: string) => string)('sample-id'), /\/$/, name);
  }
});

test('isNoindexPath covers the list, any /sent/ page and file-style paths', () => {
  for (const p of ['/404', '/404/', '/404.html', '/styleguide/', '/styleguide/index.html', '/contact/sent/', '/readiness-review/sent', '/x/sent/index.html']) {
    assert.ok(urls.isNoindexPath(p), p);
  }
  for (const p of ['/', '/about/', '/sentinel/', '/guides/sent-items/', '/404-guide/']) {
    assert.ok(!urls.isNoindexPath(p), p);
  }
});

test('entry URLs reject ids that are not slugs', () => {
  for (const bad of ['', '/', 'a b', 'Finance', '/finance/']) {
    assert.throws(() => urls.industryUrl(bad));
  }
});
