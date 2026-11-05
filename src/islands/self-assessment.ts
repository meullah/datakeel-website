// self-assessment island: one question per screen, then the Snapshot. Without it, every question shows and a note
// explains the Snapshot needs JavaScript. Answers live only in the form: nothing is stored or sent.
import { hoursText, score } from '../lib/pure/scoring.ts';

const form = document.querySelector<HTMLFormElement>('form[data-sa]');
const snapshot = document.querySelector<HTMLElement>('[data-sa-snapshot]');

if (form && snapshot) {
  const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
  const steps = [...form.querySelectorAll<HTMLFieldSetElement>('[data-sa-step]')];
  const status = $(form, '[data-sa-status]');
  const bar = $(form, '[data-sa-bar]');
  const error = $(form, '[data-sa-error]');
  const back = $<HTMLButtonElement>(form, '[data-sa-back]');
  const skip = $<HTMLButtonElement>(form, '[data-sa-skip]');
  const next = $<HTMLButtonElement>(form, '[data-sa-next]');
  const range = form.querySelector<HTMLInputElement>('[data-sa-range]');
  const rangeValue = form.querySelector<HTMLOutputElement>('[data-sa-range-value]');
  let current = 0;

  // A refresh restarts at question 1 with nothing filled in (browsers otherwise restore form values).
  form.reset();

  const syncRange = () => {
    if (!range || !rangeValue) return;
    const text = hoursText(Number(range.value));
    range.setAttribute('aria-valuetext', text);
    rangeValue.textContent = text;
  };

  const clearError = () => {
    error.textContent = '';
    for (const r of form.querySelectorAll('input[aria-invalid]')) {
      r.removeAttribute('aria-invalid');
      r.removeAttribute('aria-describedby');
    }
  };

  const show = (i: number, focus: boolean) => {
    current = i;
    steps.forEach((s, n) => (s.hidden = n !== i));
    status.textContent = `Question ${i + 1} of ${steps.length}`;
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    back.hidden = i === 0;
    skip.hidden = steps[i].dataset.saType !== 'text';
    next.textContent = i === steps.length - 1 ? 'See my snapshot' : 'Next';
    clearError();
    if (focus) steps[i].focus();
  };

  const answered = (step: HTMLFieldSetElement) =>
    step.dataset.saType !== 'choice' || !!step.querySelector('input:checked');

  const finish = () => {
    const data = new FormData(form);
    const r = score({
      reports: data.get('reports')?.toString(),
      hours: Number(data.get('hours')),
      agree: data.get('agree')?.toString(),
      systems: data.get('systems')?.toString(),
      goal: data.get('goal')?.toString(),
    });
    $(snapshot, '[data-sa-time]').hidden = r.yearlyHours === undefined;
    $(snapshot, '[data-sa-hours]').textContent = `${r.hours} ${r.hours === 1 ? 'hour' : 'hours'} a week`;
    $(snapshot, '[data-sa-yearly]').textContent = `${(r.yearlyHours ?? 0).toLocaleString('en-US')} hours a year`;
    $(snapshot, '[data-sa-goal]').hidden = !r.goal;
    $(snapshot, '[data-sa-goal-text]').textContent = r.goal ?? ''; // textContent: the visitor's words never become HTML
    $(snapshot, '[data-sa-level]').textContent = r.level.name;
    $(snapshot, '[data-sa-level-text]').textContent = r.level.text;
    $(snapshot, '[data-sa-recs]').replaceChildren(
      ...r.recommendations.map((t) => Object.assign(document.createElement('li'), { textContent: t })),
    );
    form.hidden = true;
    snapshot.hidden = false;
    $(snapshot, '#snapshot-heading').focus();
  };

  form.classList.add('is-stepped');
  $(form, '[data-sa-progress]').hidden = false;
  $(form, '[data-sa-nav]').hidden = false;
  $(form, '[data-sa-nojs]').hidden = true;
  syncRange();
  show(0, false);

  range?.addEventListener('input', syncRange);
  back.addEventListener('click', () => show(Math.max(0, current - 1), true));
  skip.addEventListener('click', () => {
    const goal = steps[current].querySelector<HTMLInputElement>('input[name="goal"]');
    if (goal) goal.value = '';
    finish();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!answered(steps[current])) {
      clearError(); // a repeat message must change to be announced again
      const radios = [...steps[current].querySelectorAll<HTMLInputElement>('input')];
      for (const r of radios) {
        r.setAttribute('aria-invalid', 'true');
        r.setAttribute('aria-describedby', error.id);
      }
      requestAnimationFrame(() => (error.textContent = 'Pick an answer to continue.'));
      radios[0]?.focus();
      return;
    }
    if (current < steps.length - 1) show(current + 1, true);
    else finish();
  });

  $(snapshot, '[data-sa-print]').addEventListener('click', () => {
    document.body.dataset.printing = 'snapshot';
    const done = () => delete document.body.dataset.printing;
    addEventListener('afterprint', done, { once: true });
    window.print();
    // Some mobile browsers never fire afterprint; print() returns once the dialog closes there, so clear soon after.
    setTimeout(done, 1000);
  });
}
