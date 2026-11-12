import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import './styles.css';
import { initCookieNotice } from './cookie.js';
import { email as cfgEmail, whatsapp as cfgWhatsapp } from '../site.config.json';

const cfg = { email: cfgEmail, whatsapp: cfgWhatsapp };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const saveData = navigator.connection && navigator.connection.saveData;
const low = small || saveData || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

$('#year').textContent = new Date().getFullYear();

/* ------------------------------------------------------------ header */
const top = $('#top');
const onScrollHeader = () => top.classList.toggle('is-scrolled', scrollY > 30);

/* ------------------------------------------------------------ chapters → camera route */
const chapters = $$('[data-cam]');
const names = chapters.map((el) => el.dataset.cam);
let tops = [];
let heights = [];
function measure() {
  tops = chapters.map((el) => el.getBoundingClientRect().top + scrollY);
  heights = chapters.map((el) => el.offsetHeight);
}
function routeAt(y) {
  const vh = innerHeight;
  for (let i = 0; i < chapters.length - 1; i++) {
    if (y < tops[i + 1]) {
      const win = Math.min(vh, heights[i]) * 0.9;
      return { i, t: clamp((y - (tops[i + 1] - win)) / win, 0, 1) };
    }
  }
  return { i: chapters.length - 1, t: 0 };
}

/* route nav (right side) */
const routeNav = $('.route');
const stops = $$('.route a');
const stopIndex = stops.map((a) => names.indexOf(a.dataset.stop));
const navLinks = $$('.top__nav a');

let city = null;
let lastActive = -1;

function onScroll() {
  onScrollHeader();
  const { i, t } = routeAt(scrollY);
  if (city) city.setRoute(names[i], names[Math.min(i + 1, names.length - 1)], t);

  const pos = i + t;
  const active = Math.round(pos);
  routeNav.style.setProperty('--p', (pos / (names.length - 1)).toFixed(4));
  if (active !== lastActive) {
    lastActive = active;
    let current = 0;
    stops.forEach((a, k) => {
      if (stopIndex[k] <= active) current = k;
    });
    stops.forEach((a, k) => {
      a.classList.toggle('is-active', k === current);
      a.classList.toggle('is-passed', k < current);
    });
    const id = chapters[active].id;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${id}`));
  }
  updateSteps();
}

/* steps road (Ablauf) */
const stepsBoard = $('.board--steps');
const stepItems = $$('.steps__item');
function updateSteps() {
  if (!stepsBoard) return;
  const sec = $('#ablauf');
  const r = sec.getBoundingClientRect();
  const p = clamp((innerHeight * 0.75 - r.top) / (r.height * 0.6), 0, 1);
  stepsBoard.style.setProperty('--p', p.toFixed(3));
  stepItems.forEach((el, k) => el.classList.toggle('is-reached', p >= k / (stepItems.length - 1) - 0.02));
}

/* reveal chapters */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-in');
  },
  { rootMargin: '0px 0px -35% 0px', threshold: 0 },
);
$$('.chapter').forEach((c) => io.observe(c));

/* ------------------------------------------------------------ 3D city */
const canvas = $('#city');
const loader = $('#loader');
const setLoad = (p) => loader.style.setProperty('--p', p);

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

// The 3D city fades in over the poster image (a pre-rendered frame of the same view)
function reveal() {
  loader.classList.remove('is-on');
  document.documentElement.classList.add('city-on');
  if (!reduced && scrollY < innerHeight * 0.5) {
    const f = $('.flash');
    f.classList.add('is-on');
    city && city.flash();
  }
}

let booted = false;
async function boot() {
  if (booted) return;
  booted = true;
  if (!webglOK()) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  loader.classList.add('is-on');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('italic 800 150px "Barlow Condensed"'), document.fonts.load('italic 700 16px "Barlow Condensed"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    const { createCity } = await import('./scene/index.js');
    city = await createCity(canvas, { labelsEl: $('#pins'), low, reducedMotion: reduced, onProgress: setLoad });
    window.__city = city;
    measure();
    onScroll();
    city.snap();
    city.start();
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  } catch (err) {
    console.error(err);
    loader.classList.remove('is-on');
    document.documentElement.classList.add('no-webgl');
  }
}

// Text first: the page is readable at once, the heavy 3D starts on the first
// interaction or when the browser is idle a moment later.
document.body.classList.add('is-ready');
measure();
onScroll();
const kick = () => boot();
for (const ev of ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll']) addEventListener(ev, kick, { once: true, passive: true });
// Phones wait for the first touch/scroll (the poster already shows the same view);
// strong computers also start on their own once the page has settled.
if (!low) {
  addEventListener('load', () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    setTimeout(() => idle(kick, { timeout: 2000 }), 6000);
  });
}

addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => {
  measure();
  onScroll();
});
addEventListener('load', () => {
  measure();
  onScroll();
});
// Off-screen chapters use content-visibility:auto, so their real height arrives later:
// re-measure the camera route whenever a section changes size.
if ('ResizeObserver' in window) {
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      measure();
      onScroll();
    });
  });
  $$('main > section').forEach((s) => ro.observe(s));
}

if (matchMedia('(pointer: fine)').matches && !reduced) {
  addEventListener(
    'pointermove',
    (e) => {
      if (city) city.setPointer((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
    },
    { passive: true },
  );
}

initCookieNotice();

/* ------------------------------------------------------------ waybill form */
const form = $('#waybill');
const status = $('#waybill-status');
const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
$('#waybill-no').textContent = `BT-${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}-${String(Math.floor(Math.random() * 900) + 100)}`;
$('#f-ts').value = String(Date.now());
$('#f-date').min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

// "… anfragen" links preselect the service
$$('[data-service]').forEach((a) =>
  a.addEventListener('click', () => {
    const r = $$('input[name="service"]', form).find((x) => x.value === a.dataset.service);
    if (r) r.checked = true;
  }),
);

function collect() {
  const fd = new FormData(form);
  const v = (k) => String(fd.get(k) || '').trim();
  return {
    fd,
    service: v('service'),
    from: v('from'),
    to: v('to'),
    date: v('date'),
    cargo: v('cargo'),
    name: v('name'),
    phone: v('phone'),
    email: v('email'),
    consent: !!fd.get('consent'),
  };
}

function validate(d, needConsent = true) {
  $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
  const errors = [];
  if (!d.name) {
    $('#f-name').closest('.wb').classList.add('is-invalid');
    errors.push('Bitte geben Sie Ihren Namen an.');
  }
  if (!d.phone && !d.email) {
    $('#f-phone').closest('.wb').classList.add('is-invalid');
    $('#f-email').closest('.wb').classList.add('is-invalid');
    errors.push('Bitte Telefon oder E-Mail angeben.');
  } else if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    $('#f-email').closest('.wb').classList.add('is-invalid');
    errors.push('Die E-Mail-Adresse scheint nicht zu stimmen.');
  }
  if (needConsent && !d.consent) {
    $('.consent', form).classList.add('is-invalid');
    errors.push('Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.');
  }
  return errors;
}

function summary(d) {
  const lines = [
    'Hallo Blitz Transport, ich möchte einen Transport anfragen:',
    d.service && `Leistung: ${d.service}`,
    d.from && `Abholung: ${d.from}`,
    d.to && `Zustellung: ${d.to}`,
    d.date && `Wunschtermin: ${new Date(d.date).toLocaleDateString('de-DE')}`,
    d.cargo && `Ladung: ${d.cargo}`,
    d.name && `Name: ${d.name}`,
    d.phone && `Telefon: ${d.phone}`,
    d.email && `E-Mail: ${d.email}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function say(msg, kind) {
  status.textContent = msg;
  status.className = `waybill__status ${kind ? `is-${kind}` : ''}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = collect();
  const errors = validate(d);
  if (errors.length) {
    say(errors[0], 'error');
    return;
  }
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  say('Wird gesendet …');
  try {
    const res = await fetch(form.action, { method: 'POST', body: d.fd, headers: { Accept: 'application/json' } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      $('#stamp-date').textContent = new Date().toLocaleDateString('de-DE');
      form.classList.add('is-sent');
      say('Danke! Ihre Anfrage ist bei uns eingegangen – wir melden uns schnellstmöglich.', 'ok');
      if (city) city.flash();
      form.reset();
      $('#f-ts').value = String(Date.now() - 5000);
      return;
    }
    if (res.status === 429) throw new Error('rate');
    throw new Error('send');
  } catch (err) {
    // no server (e.g. static preview) → open the mail programme with everything filled in
    const subject = encodeURIComponent(`Transportanfrage: ${d.service || 'Transport'} – ${d.name}`);
    const body = encodeURIComponent(summary(d));
    say(
      err.message === 'rate'
        ? 'Zu viele Anfragen in kurzer Zeit. Bitte rufen Sie uns an oder schreiben Sie per WhatsApp.'
        : 'Der Versand hat nicht geklappt – Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage.',
      'error',
    );
    if (err.message !== 'rate') location.href = `mailto:${cfg.email}?subject=${subject}&body=${body}`;
  } finally {
    btn.disabled = false;
  }
});

$('#send-wa').addEventListener('click', () => {
  // WhatsApp: the visitor sends the message themselves, so nothing is mandatory here
  const d = collect();
  $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
  say('');
  window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(summary(d))}`, '_blank', 'noopener');
});
