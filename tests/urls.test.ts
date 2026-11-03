import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as urls from '../src/lib/urls.ts';

test('internal URLs always end with a slash', () => {
  assert.equal(urls.homeUrl(), '/');
  assert.equal(urls.caseStudyUrl('auto-dealer-inventory'), '/case-studies/auto-dealer-inventory/');
  assert.equal(urls.contactSentUrl(), '/contact/sent/');
  assert.equal(urls.absoluteUrl('/about/'), 'https://datakeelai.com/about/');
  for (const [name, fn] of Object.entries(urls)) {
    if (name === 'absoluteUrl') continue;
    assert.match((fn as (id: string) => string)('sample-id'), /\/$/, name);
  }
});

test('entry URLs reject ids that are not slugs', () => {
  for (const bad of ['', '/', 'a b', 'Finance', '/finance/']) {
    assert.throws(() => urls.industryUrl(bad));
  }
});
