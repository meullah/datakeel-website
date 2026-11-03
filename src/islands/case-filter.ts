// case-filter island: filters the case grid in place. Without it, chips are plain links to the industry pages.
import { countLabel, parseIndustry } from '../lib/pure/case-filter.ts';

for (const root of document.querySelectorAll<HTMLElement>('[data-case-filter]')) {
  const chips = [...root.querySelectorAll<HTMLAnchorElement>('a[data-chip]')];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-case-card]')];
  const status = root.querySelector<HTMLElement>('[data-case-filter-status]');
  const empty = root.querySelector<HTMLElement>('[data-case-filter-empty]');
  // ponytail: ids come from the chips ("" is All), which the page already builds from the industries collection.
  const ids = chips.map((c) => c.dataset.chip!).filter(Boolean);

  const apply = (id: string | null, announce: boolean) => {
    let n = 0;
    for (const card of cards) {
      card.hidden = id !== null && card.dataset.industry !== id;
      if (!card.hidden) n++;
    }
    for (const chip of chips) {
      const on = (chip.dataset.chip || null) === id;
      chip.classList.toggle('is-selected', on);
      if (on) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
    }
    if (empty) empty.hidden = n > 0;
    if (status && announce) status.textContent = countLabel(n);
    // Only the industry key changes; other params (utm_*, gclid) stay for analytics.
    const params = new URLSearchParams(location.search);
    if (id) params.set('industry', id);
    else params.delete('industry');
    const query = params.size ? `?${params}` : '';
    if (location.search !== query) history.replaceState(history.state, '', location.pathname + query + location.hash);
  };

  for (const chip of chips)
    chip.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let new-tab clicks follow the link
      e.preventDefault();
      apply(chip.dataset.chip || null, true);
    });

  const initial = parseIndustry(location.search, ids);
  apply(initial, false); // announce only after a visitor's choice, not on load
}
