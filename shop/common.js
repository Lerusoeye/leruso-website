/* Shared shop helpers: formatting, catalogue loading, promotions (site/shop/promos.json). */
window.Shop = (() => {
  const fmt = (n) => (!n ? 'Price on request' : 'C$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brandSlug = (b) => b.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

  let promos = [];
  const promosReady = fetch('/shop/promos.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => { promos = j.promos || []; }).catch(() => {});

  function applies(pr, item) {
    const d = today(), s = pr.scope || {};
    if ((pr.start && d < pr.start) || (pr.end && d > pr.end)) return false;
    if (s.all) return true;
    return (s.brands || []).includes(item.brand) || (s.slugs || []).includes(item.slug) || (s.kinds || []).includes(item.kind);
  }
  const off = (pr, price) => Math.min(price, pr.type === 'amount' ? pr.value : Math.round(price * pr.value) / 100);
  // Best public (code-less) promo for an item → { price, was, label } or null.
  function sale(item) {
    if (!item.price) return null;
    const best = promos.filter((p) => !p.code && applies(p, item)).sort((a, b) => off(b, item.price) - off(a, item.price))[0];
    return best ? { price: +(item.price - off(best, item.price)).toFixed(2), was: item.price, label: best.label } : null;
  }
  // Checkout code → discount amount on this item (0 if the code doesn't apply).
  function codeDiscount(code, item, price) {
    const pr = promos.find((p) => p.code && p.code.toUpperCase() === String(code || '').trim().toUpperCase() && applies(p, item));
    return pr ? { amount: off(pr, price), label: pr.label } : null;
  }
  const priceHTML = (item) => {
    const s = sale(item);
    return s ? `<s class="was">${fmt(s.was)}</s> <span class="now">${fmt(s.price)}</span>` : fmt(item.price);
  };

  const cache = {};
  const brandItems = (brand) => (cache[brand] ||= fetch(`/shop/items/${brandSlug(brand)}.json`, { cache: 'no-cache' }).then((r) => r.json()));

  /* ---------- Bag (this device only) ---------- */
  const KEY = 'leruso-bag';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} badge(); };
  const bag = { get: read, add: (line) => write([...read(), line]), remove: (i) => write(read().filter((_, j) => j !== i)), clear: () => write([]) };
  function badge() { document.querySelectorAll('[data-bag]').forEach((e) => { const n = read().length; e.textContent = n ? `Bag (${n})` : 'Bag'; }); }
  document.addEventListener('DOMContentLoaded', badge);

  /* ---------- Shipping (Parham's rules) ----------
     Glasses ship free, and any order with glasses ships free. Contacts alone: $9.99 unless the order covers 6+ months
     (dailies: 4+ boxes of 90; 2-week/monthly: 6+ months). Boxes are the total for both eyes. */
  const SHIP = 9.99, LENS_DAYS = { daily: 1, '2week': 14, monthly: 30 };
  const lensDays = (c) => (c.pack * c.boxes / 2) * (LENS_DAYS[c.replacement] || 30);
  const freeDays = () => 180;
  function shippingFor(lines) {
    if (!lines.length || lines.some((l) => l.kind !== 'contacts')) return 0;
    return lines.some((l) => l.contacts && lensDays(l.contacts) >= freeDays(l.contacts)) ? 0 : SHIP;
  }
  // Boxes still needed for free shipping on this lens (0 = already free).
  function boxesToFree(c) { let n = c.boxes; while (lensDays({ ...c, boxes: n }) < freeDays(c) && n < 48) n++; return n - c.boxes; }

  /* ---------- Compare up to 3 frames (this device only) ---------- */
  const CKEY = 'leruso-compare', CMAX = 3;
  const cRead = () => { try { return JSON.parse(localStorage.getItem(CKEY)) || []; } catch { return []; } };
  const cWrite = (l) => { try { localStorage.setItem(CKEY, JSON.stringify(l)); } catch {} compareBar(); };
  const compare = {
    get: cRead, has: (slug) => cRead().some((x) => x.slug === slug),
    // returns false when already 3 are picked
    toggle(item) { const l = cRead(); if (l.some((x) => x.slug === item.slug)) { cWrite(l.filter((x) => x.slug !== item.slug)); return true; }
      if (l.length >= CMAX) return false; cWrite([...l, item]); return true; },
    remove: (slug) => cWrite(cRead().filter((x) => x.slug !== slug)), MAX: CMAX,
  };
  function compareBar() {
    let bar = document.getElementById('cmpBar'); const l = cRead();
    if (!l.length || location.pathname.startsWith('/shop/compare')) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'cmpBar'; bar.className = 'cmp-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Compare'); document.body.append(bar); }
    bar.innerHTML = `${l.map((x) => `<img src="/${esc(x.img)}" alt="${esc(x.brand + ' ' + x.title)}">`).join('')}<span>${l.length} of ${CMAX} to compare</span>
      <a class="btn btn--gold btn--sm" href="/shop/compare/">${l.length > 1 ? 'Compare now' : 'Pick one more'}</a><button type="button" class="cmp-bar__x" aria-label="Clear compare list">✕</button>`;
    bar.querySelector('.cmp-bar__x').onclick = () => cWrite([]);
    if (l.length < 2) bar.querySelector('a').removeAttribute('href');
  }
  document.addEventListener('DOMContentLoaded', compareBar);

  return { fmt, esc, brandSlug, promosReady, sale, codeDiscount, priceHTML, brandItems, bag, badge, shippingFor, boxesToFree, SHIP, compare, compareBar };
})();
