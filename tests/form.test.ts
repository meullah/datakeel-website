// Story 4.1: validation, success copy and the built form markup per variant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formSubjects, web3formsKey } from '../src/lib/config.ts';
import { companySizes, countries, errorSummary, fieldMessages, firstName, successCopy } from '../src/lib/pure/constants.ts';
import { validate } from '../src/lib/pure/form.ts';

const valid = { name: 'Sara Collins', email: 'sara@lakeside.com', company: 'Lakeside Logistics', message: 'Spreadsheets everywhere.' };

test('validate: required name, email, company, message; optional role, size, country', () => {
  for (const variant of ['readiness-review', 'contact'] as const) {
    assert.deepEqual(validate(valid, variant), {});
    assert.deepEqual(Object.keys(validate({}, variant)), ['name', 'email', 'company', 'message']);
    assert.deepEqual(validate({ ...valid, name: '   ' }, variant), { name: fieldMessages[variant].name });
  }
  assert.equal(validate({}, 'readiness-review').message, 'Please tell us a little about your data challenge.');
  assert.equal(validate({}, 'contact').message, 'Please add a message.');
});

test('validate: email must look like an address; any domain is fine', () => {
  for (const email of ['', 'sara@', 'sara', '@x.com', 'sara@x', 'sara @x.com'])
    assert.deepEqual(validate({ ...valid, email }, 'contact'), { email: 'Please add your work email so we can reply.' }, email);
  for (const email of ['sara@gmail.com', ' sara.c+rr@sub.example.co.uk ']) assert.deepEqual(validate({ ...valid, email }, 'contact'), {}, email);
});

test('firstName and success headings', () => {
  assert.equal(firstName('  Sara  Collins '), 'Sara');
  assert.equal(firstName(''), '');
  assert.equal(successCopy['readiness-review'].heading('  Sara  Collins '), 'Thanks, Sara. We’ll reply within one business day with details and pricing.');
  assert.equal(successCopy.contact.heading('   '), 'Thanks. We’ll get back to you within one business day.');
  assert.equal(successCopy.contact.label, 'Message sent');
});

test('error summary, sizes, countries', () => {
  assert.equal(errorSummary(['Work email']), 'One field needs your attention: Work email.');
  assert.equal(errorSummary(['Name', 'Work email']), '2 fields need your attention: Name, Work email.');
  assert.deepEqual(companySizes, ['1–49 people', '50–249 people', '250–999 people', '1,000+ people']);
  const list = countries();
  assert.equal(list.length, 249);
  assert.equal(new Set(list).size, 249);
  assert.deepEqual([...list].sort((a, b) => a.localeCompare(b, 'en')), list, 'alphabetical');
  for (const name of ['United States', 'United Kingdom', 'Germany', 'India']) assert.ok(list.includes(name), name);
});

const file = fileURLToPath(new URL('../dist/styleguide/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/styleguide/index.html not found; run npm run build first' };
const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
const forms = (variant: string) => (html.match(/<form\b[\s\S]*?<\/form>/g) ?? []).filter((f) => f.includes(`data-form="${variant}"`));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const hidden = (form: string) => Object.fromEntries([...form.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)].map(([t]) => [attr(t, 'name'), attr(t, 'value')]));
const fieldNames = (form: string) => [...form.matchAll(/<(?:input|select|textarea)\b[^>]*class="form-input[^>]*>/g)].map(([t]) => attr(t, 'name'));

test('built form: action, hidden fields and field set per variant', skip, () => {
  const expected = {
    'readiness-review': { fields: ['name', 'email', 'company', 'role', 'companySize', 'country', 'message'], redirect: 'https://datakeelai.com/readiness-review/sent/', label: 'What’s your main data challenge?' },
    contact: { fields: ['name', 'email', 'company', 'country', 'message'], redirect: 'https://datakeelai.com/contact/sent/', label: 'Message' },
  } as const;
  for (const [variant, want] of Object.entries(expected) as [keyof typeof expected, (typeof expected)[keyof typeof expected]][]) {
    const found = forms(variant);
    assert.equal(found.length, 2, `${variant}: one per theme panel`);
    for (const form of found) {
      const open = form.match(/<form\b[^>]*>/)![0];
      assert.equal(attr(open, 'method'), 'POST');
      assert.equal(attr(open, 'action'), 'https://api.web3forms.com/submit');
      assert.deepEqual(hidden(form), { access_key: web3formsKey, form_type: variant, subject: formSubjects[variant], redirect: want.redirect });
      assert.match(form, /<input\b[^>]*type="checkbox"[^>]*name="botcheck"[^>]*style="display:none"/);
      assert.deepEqual(fieldNames(form), want.fields);
      for (const name of ['name', 'email', 'company', 'message']) assert.match(form, new RegExp(`<(input|textarea)\\b[^>]*name="${name}"[^>]*required`), `${name} required`);
      for (const name of variant === 'readiness-review' ? ['role', 'companySize', 'country'] : ['country']) {
        const tag = form.match(new RegExp(`<(?:input|select)\\b[^>]*name="${name}"[^>]*>`))![0];
        assert.doesNotMatch(tag, /\srequired\b/, `${name} optional`);
        assert.match(form, new RegExp(`<label for="[^"]*-${name}"[^>]*>[^<]*<span[^>]*> \\(optional\\)</span>`), `${name} label says optional`);
      }
      assert.ok(form.includes(`>${want.label}</label>`), want.label);
      assert.match(form, /We only use your details to reply\. See our <a href="\/privacy\/"[^>]*>privacy notice<\/a>\./);
      assert.match(form, /autocomplete="email"/);
      assert.match(form, /<option value=""[^>]*>Select…<\/option>/);
    }
  }
  assert.notEqual(formSubjects['readiness-review'], formSubjects.contact);
});
