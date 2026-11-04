// form island: validates on blur and submit, posts JSON to Web3Forms and swaps in the success state.
// Without it (or if it fails to load), the plain HTML form posts to Web3Forms and redirects to /sent/.
import { errorSummary, sendingLabel, successCopy, type FormVariant } from '../lib/pure/constants.ts';
import { validate } from '../lib/pure/form.ts';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-form]')) {
  const variant = form.dataset.form as FormVariant;
  const template = form.parentElement?.querySelector<HTMLTemplateElement>('template[data-form-success]');
  const summary = form.querySelector<HTMLElement>('[data-form-summary]');
  const failure = form.querySelector<HTMLElement>('[data-form-failure]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const controls = [...form.querySelectorAll<Control>('.form-input')];
  if (!template || !button) continue; // leave the plain form alone
  const buttonLabel = button.textContent;
  form.noValidate = true;

  const values = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)]));
  // Only required fields error, and their labels carry no "(optional)" suffix.
  const labelOf = (c: Control) => c.labels?.[0]?.textContent?.trim() || c.name;

  // Shows or clears each control's error; returns the invalid ones in DOM order.
  const check = (only?: Control) => {
    const errors = validate(values(), variant);
    const invalid: Control[] = [];
    for (const c of controls) {
      const box = form.querySelector<HTMLElement>(`#${CSS.escape(c.id)}-error`);
      if (!box) continue;
      const message = errors[c.name];
      if (message) invalid.push(c);
      if (only && c !== only) continue;
      box.hidden = !message;
      box.querySelector('[data-form-error-text]')!.textContent = message ?? '';
      if (message) {
        c.setAttribute('aria-invalid', 'true');
        c.setAttribute('aria-describedby', box.id);
      } else {
        c.removeAttribute('aria-invalid');
        c.removeAttribute('aria-describedby');
      }
    }
    // Once announced, the summary follows field fixes (empty when nothing is left).
    if (only && summary?.textContent) summary.textContent = invalid.length ? errorSummary(invalid.map(labelOf)) : '';
    return invalid;
  };

  for (const c of controls) {
    c.addEventListener('blur', () => check(c));
    c.addEventListener('input', () => {
      if (c.getAttribute('aria-invalid') === 'true') check(c);
    });
  }

  const showSuccess = (name: string, convert = true) => {
    const block = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    block.querySelector('[data-form-success-heading]')!.textContent = successCopy[variant].heading(name);
    form.replaceWith(block);
    block.focus();
    const redirect = form.querySelector<HTMLInputElement>('input[name="redirect"]')?.value;
    if (!convert || !redirect) return;
    history.pushState(null, '', new URL(redirect).pathname);
    addEventListener('popstate', () => location.reload(), { once: true }); // Back: show the form again
  };

  const send = async () => {
    const data = values();
    if (data.botcheck) return showSuccess(data.name ?? '', false); // spam: accept silently, send nothing, count nothing
    const invalid = check();
    if (summary) {
      // Clear, then set next frame, so an identical repeat is announced again.
      summary.textContent = '';
      const text = invalid.length ? errorSummary(invalid.map(labelOf)) : '';
      requestAnimationFrame(() => (summary.textContent = text));
    }
    if (invalid.length) return invalid[0].focus();

    if (failure) failure.hidden = true;
    button.disabled = true;
    button.textContent = sendingLabel;
    let ok = false;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000), // a stalled request ends in the failure banner
      });
      // Web3Forms can answer 200 with success: false; a body that fails to parse counts as failure.
      ok = res.status === 200 && (await res.json()).success === true;
    } catch {
      // network error, timeout or bad JSON: fall through to the failure banner
    }
    if (ok) return showSuccess(data.name ?? '');
    button.disabled = false;
    button.textContent = buttonLabel;
    if (failure) failure.hidden = false;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // ponytail: an unexpected island bug falls back to the native POST, which still reaches the inbox.
    send().catch(() => form.submit());
  });
}
