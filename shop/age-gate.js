// Camera age check: before the camera opens (try-on, fitting), ask who is in front of it.
// Under 16 needs a parent or guardian's OK. Asked once per visit. Nothing is sent anywhere.
(function () {
  const KEY = 'leruso-cam-ok';
  const css = `.ag{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,9,8,.72);padding:16px}
.ag__box{max-width:420px;width:100%;background:#faf7f2;color:#1a1714;border-radius:14px;padding:24px 22px;font:15px/1.5 -apple-system,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.ag__box h2{font:500 22px/1.2 Georgia,serif;margin:0 0 6px}.ag__box p{margin:0 0 14px;color:#4a443d}
.ag__opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #d9d1c4;border-radius:10px;margin-bottom:8px;cursor:pointer}
.ag__opt input{margin-top:4px}.ag__guard{display:none;font-size:14px;margin:6px 0 4px}.ag__guard.on{display:flex}
.ag__err{color:#a3341f;font-size:13px;min-height:18px;margin:4px 0}
.ag__row{display:flex;gap:10px;justify-content:flex-end;margin-top:8px}
.ag__row button{font:600 14px -apple-system,system-ui,sans-serif;border-radius:999px;padding:10px 18px;border:1px solid #b8964f;cursor:pointer}
.ag__go{background:#b8964f;color:#fff}.ag__no{background:transparent;color:#6b5a35}`;
  window.ageGate = function () {
    try { if (sessionStorage.getItem(KEY) === '1') return Promise.resolve(true); } catch (e) { /* private mode: ask each time */ }
    return new Promise((resolve) => {
      if (!document.getElementById('ag-css')) { const s = document.createElement('style'); s.id = 'ag-css'; s.textContent = css; document.head.append(s); }
      const d = document.createElement('div'); d.className = 'ag'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      d.innerHTML = `<div class="ag__box"><h2>Who's in front of the camera?</h2>
        <p>Your camera image stays on this device. It is never recorded, uploaded or saved.</p>
        <label class="ag__opt"><input type="radio" name="ag" value="adult"><span>I'm 16 or older</span></label>
        <label class="ag__opt"><input type="radio" name="ag" value="kid"><span>A child under 16</span></label>
        <label class="ag__opt ag__guard"><input type="checkbox" id="agOk"><span>I'm their parent or legal guardian, and I allow the camera to be used for this child.</span></label>
        <p class="ag__err" role="alert"></p>
        <div class="ag__row"><button class="ag__no" type="button">Cancel</button><button class="ag__go" type="button">Continue</button></div></div>`;
      document.body.append(d);
      const guard = d.querySelector('.ag__guard'), err = d.querySelector('.ag__err');
      d.querySelectorAll('input[name=ag]').forEach((r) => r.addEventListener('change', () => { guard.classList.toggle('on', r.value === 'kid' && r.checked); err.textContent = ''; }));
      const done = (ok) => { d.remove(); if (ok) { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } } resolve(ok); };
      d.querySelector('.ag__no').addEventListener('click', () => done(false));
      d.querySelector('.ag__go').addEventListener('click', () => {
        const v = (d.querySelector('input[name=ag]:checked') || {}).value;
        if (!v) { err.textContent = 'Please choose one.'; return; }
        if (v === 'kid' && !d.querySelector('#agOk').checked) { err.textContent = 'A parent or guardian needs to tick the box to continue.'; return; }
        done(true);
      });
    });
  };
})();
