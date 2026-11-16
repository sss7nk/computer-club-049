// BOM: persist a device preference, follow the OS before a choice is made,
// and synchronise independently opened tabs. No business data is stored here.
const key = 'club049.theme';
const system = window.matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = window.localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
const valid = value => value === 'dark' || value === 'light';
let current = valid(preference) ? preference : (system.matches ? 'dark' : 'light');
function apply(value) {
  current = value;
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#0a0b12' : '#f1f2f8');
  document.querySelectorAll('[data-action="theme"]').forEach(button => {
    button.innerHTML = themeIcon();
    button.setAttribute('aria-label', value === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    button.title = button.getAttribute('aria-label');
  });
}
function themeIcon() {
  return current === 'dark'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/></svg>';
}
export function themeButton() {
  const label = current === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  return `<button type="button" class="theme-switch" data-action="theme" aria-label="${label}" title="${label}">${themeIcon()}</button>`;
}
export function toggleTheme() {
  preference = current === 'dark' ? 'light' : 'dark';
  try { window.localStorage.setItem(key, preference); } catch { /* Preference remains active in this tab. */ }
  apply(preference);
}
export function initTheme() {
  apply(current);
  system.addEventListener('change', event => { if (!valid(preference)) apply(event.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue;
    apply(valid(preference) ? preference : (system.matches ? 'dark' : 'light'));
  });
}
