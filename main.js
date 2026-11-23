// Leruso Eyewear — interactions
// Scroll-scrubbed hero, horizontal collection, parallax, reveals (Motion), smooth scroll (Lenis).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 860;

/* ---------- smooth scroll ---------- */
let lenis = null;
function initLenis() {
  if (reduceMotion || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(target, { offset: 0, duration: 1.6 });
  }));
}
window.addEventListener('load', initLenis);

/* ---------- hero frame sequence ---------- */
const FRAME_COUNT = 151;
// 1080p frames on desktop / high-DPI tablets, 720p on phones
const SEQ_DIR = (innerWidth > 860 || (innerWidth * (devicePixelRatio || 1)) > 1400) ? 'seq-d' : 'seq-m';
const frameSrc = (i) => `assets/${SEQ_DIR}/f${String(i + 1).padStart(3, '0')}.jpg`;
const frames = new Array(FRAME_COUNT);
const hero = $('.hero');
const canvas = $('.hero__canvas');
const ctx = canvas.getContext('2d');
const small = document.createElement('canvas');   // blurred backdrop
const sctx = small.getContext('2d');
const layer = document.createElement('canvas');   // feathered sharp frame
const lctx = layer.getContext('2d');
let loaded = 0;
let lastDrawn = -1;
let shownFrame = 0;      // eased frame position for buttery scrubbing
let targetFrame = 0;

function loadFrames(onProgress) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        loaded++;
        onProgress(loaded / FRAME_COUNT);
        if (loaded >= Math.min(FRAME_COUNT, 36) && frames[0]?.complete) done();
        if (loaded === FRAME_COUNT) done();
      };
      img.src = frameSrc(i);
      frames[i] = img;
    }
    setTimeout(done, 5000);
  });
}

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  small.width = 8; small.height = 8;
  lastDrawn = -1;
}

function nearestLoaded(i) {
  for (let d = 0; d < FRAME_COUNT; d++) {
    const a = frames[i - d], b = frames[i + d];
    if (a && a.complete && a.naturalWidth) return a;
    if (b && b.complete && b.naturalWidth) return b;
  }
  return null;
}

function drawFrame(index, p) {
  const img = nearestLoaded(index);
  if (!img) return;
  const W = canvas.width, H = canvas.height;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const zoom = 1 + p * 0.06;

  if (W / H < 0.8) {
    // Portrait screens: full-bleed cover
    const s = Math.max(W / iw, H / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2 - H * 0.04, dw, dh);
    return;
  }

  // Landscape: blurred cover backdrop + feathered sharp frame on the right
  sctx.drawImage(img, 0, 0, iw, ih * 0.22, 0, 0, small.width, small.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, W, H);
  ctx.fillStyle = 'rgba(12,11,9,.55)';
  ctx.fillRect(0, 0, W, H);

  const dh = H * 1.28 * zoom, dw = dh * (iw / ih);
  const cx = W * (W / H > 1.4 ? 0.66 : 0.6);
  layer.width = Math.ceil(dw); layer.height = Math.ceil(dh);
  lctx.imageSmoothingQuality = 'high';
  lctx.drawImage(img, 0, 0, dw, dh);
  lctx.globalCompositeOperation = 'destination-in';
  const g = lctx.createLinearGradient(0, 0, dw, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.32, 'rgba(0,0,0,1)');
  g.addColorStop(0.68, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g;
  lctx.fillRect(0, 0, dw, dh);
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, cx - dw / 2, (H - dh) / 2 + H * 0.04);
}

/* ---------- hero text beats ---------- */
const beats = $$('.beat').map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to }));
function updateBeats(p) {
  const fade = 0.05;
  beats.forEach(({ el, from, to }) => {
    let o = 0;
    if (p >= from && p <= to) {
      o = Math.min(1, (p - from) / fade, (to - p) / fade);
      if (from === 0) o = Math.min(1, (to - p) / fade);
      if (to > 1) o = Math.min(1, (p - from) / fade);
    }
    o = clamp(o);
    const y = (1 - o) * 30 * (p < (from + to) / 2 ? 1 : -1);
    el.style.opacity = o;
    el.style.transform = isMobile() ? `translateY(${y}px)` : `translateY(calc(-50% + ${y}px))`;
    el.classList.toggle('is-on', o > 0.01);
  });
}

/* ---------- collection horizontal scroll ---------- */
const collection = $('.collection');
const track = $('.collection__track');

/* ---------- parallax ---------- */
const parallaxEls = $$('.parallax').map((wrap) => ({ wrap, media: wrap.querySelector('img, video') }));

/* ---------- nav + progress ---------- */
const nav = $('.nav');
const progressBar = $('.progress span');
let lastY = 0;

let lastUpdateY = -1;
function update(force) {
  const y = scrollY, vh = innerHeight;
  if (y === lastUpdateY && !force) return;
  lastUpdateY = y;

  // hero
  const hTop = hero.offsetTop, hLen = hero.offsetHeight - vh;
  const p = clamp((y - hTop) / hLen);
  if (y < hTop + hero.offsetHeight) {
    targetFrame = p * (FRAME_COUNT - 1);
    if (force) shownFrame = targetFrame;
    updateBeats(p);
  }

  // collection
  if (!isMobile()) {
    const cTop = collection.offsetTop, cLen = collection.offsetHeight - vh;
    const cp = clamp((y - cTop) / cLen);
    const max = track.scrollWidth - innerWidth;
    track.style.transform = `translate3d(${-cp * max}px,0,0)`;
  }

  // parallax
  if (!reduceMotion) {
    parallaxEls.forEach(({ wrap, media }) => {
      const r = wrap.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const t = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
      media.style.transform = `translate3d(0,${t * -8}%,0)`;
    });
  }

  // nav
  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > lastY + 4 && y > vh * 1.2 && !$('.menu').classList.contains('is-open'));
  if (y < lastY - 4) nav.classList.remove('is-hidden');
  lastY = y;

  // page progress
  const docH = document.documentElement.scrollHeight - vh;
  progressBar.style.transform = `scaleX(${clamp(y / docH)})`;
}
function frameLoop() {
  update();
  // ease the displayed frame toward the scroll target
  const diff = targetFrame - shownFrame;
  shownFrame = Math.abs(diff) < 0.02 ? targetFrame : shownFrame + diff * (reduceMotion ? 1 : 0.18);
  const idx = Math.round(shownFrame);
  if (idx !== lastDrawn) { drawFrame(idx, shownFrame / (FRAME_COUNT - 1)); lastDrawn = idx; }
  requestAnimationFrame(frameLoop);
}
addEventListener('scroll', () => {
  update();
  if (document.hidden) { // rAF paused (background tab) — draw directly
    const idx = Math.round(targetFrame);
    if (idx !== lastDrawn) { shownFrame = targetFrame; drawFrame(idx, targetFrame / (FRAME_COUNT - 1)); lastDrawn = idx; }
  }
}, { passive: true });

/* ---------- boot ---------- */
const loader = $('.loader');
const loaderBar = $('.loader__bar span');
sizeCanvas();
addEventListener('resize', () => { sizeCanvas(); update(true); });
loadFrames((f) => { loaderBar.style.width = `${Math.round(f * 100)}%`; }).then(() => {
  drawFrame(0, 0); lastDrawn = 0;
  loader.classList.add('is-done');
  update(true);
  requestAnimationFrame(frameLoop);
  introAnimation();
});

/* ---------- videos: play only when visible ---------- */
const vio = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) { target.preload = 'auto'; target.play().catch(() => {}); }
    else target.pause();
  });
}, { rootMargin: '200px' });
$$('video').forEach((v) => vio.observe(v));

/* ---------- mobile menu ---------- */
const burger = $('.nav__burger');
const menu = $('.menu');
function closeMenu() {
  menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
  burger.setAttribute('aria-expanded', 'false');
}
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
});
$$('.menu a').forEach((a) => a.addEventListener('click', () => { if (!lenis) closeMenu(); }));

/* ---------- Solana variant switch ---------- */
$$('.variant-switch button').forEach((btn) => btn.addEventListener('click', () => {
  const v = btn.dataset.variant;
  $$('.variant-switch button').forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  $$('.rare__media img').forEach((img) => img.classList.toggle('is-active', img.dataset.variant === v));
  $$('.rare__facts dd[data-blue]').forEach((dd) => {
    dd.style.opacity = 0;
    setTimeout(() => { dd.textContent = dd.dataset[v === '24k' ? '24k' : 'blue']; dd.style.opacity = 1; }, 250);
  });
}));

/* ---------- reviews rotator ---------- */
const reviews = $$('.review');
let ri = 0;
setInterval(() => {
  reviews[ri].classList.remove('is-active');
  ri = (ri + 1) % reviews.length;
  reviews[ri].classList.add('is-active');
}, 5200);

/* ---------- open-now (Toronto time) ---------- */
(function openStatus() {
  const hours = { 0: null, 1: [10, 18], 2: [10, 18], 3: [11, 17], 4: [10, 18], 5: [11, 17], 6: [11, 15] };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.find((x) => x.type === 'weekday').value];
  const h = +parts.find((x) => x.type === 'hour').value % 24 + parts.find((x) => x.type === 'minute').value / 60;
  $(`.hours tr[data-day="${wd}"]`)?.classList.add('is-today');
  const el = $('[data-open-status]');
  const today = hours[wd];
  const fmt = (n) => `${n > 12 ? n - 12 : n}:00 ${n >= 12 ? 'PM' : 'AM'}`;
  if (today && h >= today[0] && h < today[1]) {
    el.textContent = `Open now · closes ${fmt(today[1])}`; el.classList.add('is-open');
  } else {
    let d = wd, n = 0;
    do { d = (d + 1) % 7; n++; } while (!hours[d]);
    const opensToday = today && h < today[0];
    el.textContent = opensToday ? `Closed · opens today at ${fmt(today[0])}` : `Closed · opens ${n === 1 ? 'tomorrow' : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]} at ${fmt(hours[d][0])}`;
    el.classList.add('is-closed');
  }
})();
$('[data-year]').textContent = new Date().getFullYear();

/* ---------- reveals: native IntersectionObserver + CSS transitions ---------- */
if (!reduceMotion) {
  document.documentElement.classList.add('reveal-ready');
  // stagger siblings that reveal together
  $$('.eyecare__grid, .stats, .feature__strip').forEach((group) => {
    $$('.reveal', group).forEach((el, i) => { el.style.transitionDelay = `${i * 0.12}s`; });
  });
  const rio = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  $$('.reveal, .wipe').forEach((el) => rio.observe(el));
}

/* ---------- Motion (Framer Motion's vanilla engine) ---------- */
let motionLib = null;
async function loadMotion() {
  if (reduceMotion || location.search.includes('static')) return null;
  try {
    motionLib = await import('https://cdn.jsdelivr.net/npm/motion@11.18.2/+esm');
    return motionLib;
  } catch { return null; }
}
const motionReady = loadMotion();

function splitWords(el) {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span>${w}</span></span>`).join(' ');
  return $$('.w > span', el);
}

async function introAnimation() {
  const m = await motionReady;
  if (!m) return;
  const { animate, inView, stagger } = m;
  const ease = [0.16, 1, 0.3, 1];

  // hero intro
  animate('.beat--1 > *', { opacity: [0, 1], y: [30, 0] }, { delay: stagger(0.12), duration: 1.2, ease });

  // split quote
  $$('.split').forEach((el) => {
    const words = splitWords(el);
    words.forEach((w) => { w.style.transform = 'translateY(110%)'; });
    inView(el, () => { animate(words, { y: ['110%', '0%'] }, { delay: stagger(0.06), duration: 1.1, ease }); }, { margin: '0px 0px -20% 0px' });
  });

  // counters
  $$('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    el.textContent = (0).toFixed(dec);
    inView(el, () => {
      animate(0, target, { duration: 2, ease, onUpdate: (v) => { el.textContent = v.toFixed(dec); } });
    });
  });
}
