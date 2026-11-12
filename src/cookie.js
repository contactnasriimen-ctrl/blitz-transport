// Cookie notice. The site sets no tracking, analytics or advertising cookies;
// the only thing stored is the visitor's "understood" choice (localStorage, strictly necessary).
// The markup is in each HTML page (so it paints with the page); an inline script in <head>
// adds .cookie-ok to <html> when the notice was already confirmed.
const KEY = 'blitz-cookie-hinweis';

export function initCookieNotice() {
  const box = document.querySelector('.cookie');
  if (!box) return;
  const root = document.documentElement;
  const ok = box.querySelector('.cookie__ok');
  ok.addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, new Date().toISOString().slice(0, 10));
    } catch {
      /* private mode: the notice simply shows again next time */
    }
    root.classList.add('cookie-ok');
    box.classList.remove('is-open');
  });
  document.querySelectorAll('[data-cookie-open]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      box.classList.add('is-open');
      ok.focus();
    }),
  );
}
