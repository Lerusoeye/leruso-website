// Menu pages (/collection/, /maisons/, /eye-care/, /boutique/, /visit/): the light parts of main.js, without the home hero.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* mobile menu */
const burger = $('.nav__burger'), menu = $('.menu');
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
});

/* videos play only when visible */
const vio = new IntersectionObserver((es) => es.forEach(({ target, isIntersecting }) => {
  if (isIntersecting) { target.preload = 'auto'; target.play().catch(() => {}); } else target.pause();
}), { rootMargin: '200px' });
$$('video').forEach((v) => vio.observe(v));

/* reveals */
if (!reduceMotion) {
  document.documentElement.classList.add('reveal-ready');
  const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  $$('.reveal, .wipe').forEach((el) => rio.observe(el));
}

/* reviews rotator */
const reviews = $$('.review');
if (reviews.length) { let ri = 0; setInterval(() => { reviews[ri].classList.remove('is-active'); ri = (ri + 1) % reviews.length; reviews[ri].classList.add('is-active'); }, 5200); }

/* Solana 18K / 24K switch */
$$('.variant-switch button').forEach((btn) => btn.addEventListener('click', () => {
  const v = btn.dataset.variant;
  $$('.variant-switch button').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
  $$('.rare__media img').forEach((img) => img.classList.toggle('is-active', img.dataset.variant === v));
  $$('.rare__facts dd[data-blue]').forEach((dd) => { dd.textContent = dd.dataset[v === '24k' ? '24k' : 'blue']; });
}));

/* open now (Toronto time) — same hours as main.js */
const el = $('[data-open-status]');
if (el) {
  const hours = { 0: null, 1: [10, 18], 2: [10, 18], 3: [11, 17], 4: [10, 18], 5: [11, 17], 6: [11, 15] };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find((x) => x.type === 'weekday').value];
  const h = +parts.find((x) => x.type === 'hour').value % 24 + parts.find((x) => x.type === 'minute').value / 60;
  $(`.hours tr[data-day="${wd}"]`)?.classList.add('is-today');
  const today = hours[wd], fmt = (n) => `${n > 12 ? n - 12 : n}:00 ${n >= 12 ? 'PM' : 'AM'}`;
  if (today && h >= today[0] && h < today[1]) { el.textContent = `Open now · closes ${fmt(today[1])}`; el.classList.add('is-open'); }
  else {
    let d = wd, n = 0; do { d = (d + 1) % 7; n++; } while (!hours[d]);
    el.textContent = today && h < today[0] ? `Closed · opens today at ${fmt(today[0])}` : `Closed · opens ${n === 1 ? 'tomorrow' : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]} at ${fmt(hours[d][0])}`;
    el.classList.add('is-closed');
  }
}
$('[data-year]').textContent = new Date().getFullYear();
