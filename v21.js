(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const nameIndex = new Map();
  for (const series of data) {
    for (const fig of series.figures || []) {
      nameIndex.set(fig.name, {...fig, seriesId:series.id, seriesName:series.name, set:series.set});
    }
  }

  const scanView = document.getElementById('scanView');
  const resultCard = document.getElementById('resultCard');
  const resultName = document.getElementById('resultName');
  const ownedBtn = document.getElementById('ownedBtn');
  const scanAgainBtn = document.getElementById('scanAgainBtn');
  const unknownCard = document.getElementById('unknownCard');
  const startBtn = document.getElementById('startBtn');
  if (!scanView || !resultCard || !ownedBtn || !scanAgainBtn) return;

  let active = false;
  let wishlistOnly = localStorage.getItem('brickscan-store-wishlist-only') === '1';

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function readObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function quantity(id) {
    const counts = readObject('brickscan-counts');
    const n = Math.floor(Number(counts[id]) || 0);
    if (n > 0) return Math.min(99, n);
    return readArray('brickscan-owned').includes(id) ? 1 : 0;
  }
  function isWished(id) { return readArray('brickscan-wishlist').includes(id); }

  function injectUi() {
    if (document.getElementById('storeModeToggle')) return;

    const launcher = document.createElement('div');
    launcher.className = 'store-mode-launcher';
    const button = document.createElement('button');
    button.id = 'storeModeToggle';
    button.type = 'button';
    button.className = 'store-mode-toggle';
    button.textContent = '🛒 Mode magasin';
    launcher.appendChild(button);
    scanView.insertBefore(launcher, scanView.firstChild);

    const panel = document.createElement('section');
    panel.id = 'storeModePanel';
    panel.className = 'store-mode-panel hidden';
    panel.innerHTML = `
      <div class="store-mode-head">
        <div><div class="eyebrow">MODE MAGASIN</div><strong>Scan express</strong></div>
        <button id="storeModeExit" type="button" class="store-mode-exit">✕ Quitter</button>
      </div>
      <label class="store-wishlist-only">
        <input id="storeWishlistOnly" type="checkbox">
        <span><strong>★ Je cherche seulement ma wishlist</strong><small id="storeWishlistCount"></small></span>
      </label>
    `;
    launcher.after(panel);

    const status = document.createElement('div');
    status.id = 'storeResultStatus';
    status.className = 'store-result-status hidden';
    const badge = resultCard.querySelector('.result-badge');
    if (badge) badge.after(status); else resultCard.prepend(status);

    const style = document.createElement('style');
    style.id = 'storeModeStyles';
    style.textContent = `
      .store-mode-launcher{display:flex;justify-content:flex-end;margin:0 0 10px}
      .store-mode-toggle{border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:999px;padding:8px 12px;font:inherit;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(17,24,39,.05)}
      .store-mode-panel{display:grid;gap:12px;margin:0 0 12px;padding:14px;background:#111827;color:#fff;border-radius:18px;box-shadow:0 10px 28px rgba(17,24,39,.18)}
      .store-mode-panel.hidden{display:none}.store-mode-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.store-mode-head .eyebrow{color:#9ca3af}.store-mode-head strong{font-size:20px}.store-mode-exit{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;padding:8px 11px;font:inherit;font-size:12px;font-weight:800}
      .store-wishlist-only{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.08);padding:10px 11px;border-radius:13px}.store-wishlist-only input{width:20px;height:20px}.store-wishlist-only span{display:grid;gap:2px}.store-wishlist-only strong{font-size:12px}.store-wishlist-only small{font-size:10px;color:#d1d5db}
      .store-result-status{margin:10px 0 12px;padding:12px 14px;border-radius:14px;font-size:16px;font-weight:900;text-align:center;letter-spacing:.01em}.store-result-status.hidden{display:none}.store-result-status.new{background:#dcfce7;color:#166534;border:1px solid #86efac}.store-result-status.owned{background:#e5e7eb;color:#111827;border:1px solid #d1d5db}.store-result-status.wish{background:#fef9c3;color:#854d0e;border:1px solid #fde047}.store-result-status.skip{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
      body.store-mode-active .bottom-nav{display:none}
      body.store-mode-active #scanView>.hero-card,body.store-mode-active #scanView>.manual-card{display:none}
      body.store-mode-active #scanView{padding-bottom:18px}
      body.store-mode-active .store-mode-launcher{display:none}
      body.store-mode-active .scanner-card{margin-top:0}
      body.store-mode-active .scanner-stage{min-height:min(54vh,520px)}
      body.store-mode-active #resultCard{border:2px solid #111827;box-shadow:0 18px 42px rgba(17,24,39,.16)}
      body.store-mode-active #resultCard h2{font-size:28px;line-height:1.05;margin-top:10px}
      body.store-mode-active #resultCard .result-photo{width:min(310px,78vw);max-height:310px;object-fit:contain}
      body.store-mode-active #ownedBtn,body.store-mode-active #scanAgainBtn{min-height:54px;font-size:16px;font-weight:900}
      body.store-mode-active #unknownCard{border:2px solid #dc2626}
      body.store-mode-active.store-wishlist-target #resultCard.store-skip #ownedBtn{opacity:.62}
      @media(max-width:480px){body.store-mode-active .topbar{padding-top:max(8px,env(safe-area-inset-top));padding-bottom:8px}body.store-mode-active .topbar .brand-mark{display:none}body.store-mode-active .topbar h1{font-size:17px}body.store-mode-active .topbar p{font-size:10px}.store-mode-panel{border-radius:14px}.store-mode-head strong{font-size:18px}}
    `;
    document.head.appendChild(style);

    button.addEventListener('click', () => setActive(true));
    document.getElementById('storeModeExit')?.addEventListener('click', () => setActive(false));
    const checkbox = document.getElementById('storeWishlistOnly');
    if (checkbox) {
      checkbox.checked = wishlistOnly;
      checkbox.addEventListener('change', () => {
        wishlistOnly = checkbox.checked;
        localStorage.setItem('brickscan-store-wishlist-only', wishlistOnly ? '1' : '0');
        updateModeClasses();
        decorateResult();
      });
    }
    updateWishlistCount();
  }

  function updateWishlistCount() {
    const count = readArray('brickscan-wishlist').length;
    const el = document.getElementById('storeWishlistCount');
    if (el) el.textContent = `${count} souhait${count !== 1 ? 's' : ''} dans ta liste`;
  }

  function updateModeClasses() {
    document.body.classList.toggle('store-mode-active', active);
    document.body.classList.toggle('store-wishlist-target', active && wishlistOnly);
    document.getElementById('storeModePanel')?.classList.toggle('hidden', !active);
  }

  function setActive(value) {
    active = Boolean(value);
    sessionStorage.setItem('brickscan-store-mode', active ? '1' : '0');
    updateModeClasses();
    decorateResult();
    if (active) {
      window.scrollTo({top:0, behavior:'smooth'});
      if (resultCard.classList.contains('hidden') && startBtn && !startBtn.classList.contains('hidden')) {
        startBtn.scrollIntoView({behavior:'smooth', block:'center'});
      }
    }
  }

  function decorateResult() {
    const status = document.getElementById('storeResultStatus');
    if (!status) return;
    if (!active || resultCard.classList.contains('hidden')) {
      status.classList.add('hidden');
      resultCard.classList.remove('store-skip');
      scanAgainBtn.textContent = active ? '▦ Scanner la suivante' : 'Scanner une autre boîte';
      return;
    }

    const fig = nameIndex.get(resultName?.textContent?.trim());
    if (!fig) return;
    const qty = quantity(fig.id);
    const wished = isWished(fig.id);
    let text = '';
    let kind = '';

    if (wishlistOnly && !wished) {
      text = qty > 0 ? `↷ PAS SUR TA WISHLIST · DÉJÀ ×${qty}` : '↷ PAS SUR TA WISHLIST';
      kind = 'skip';
      resultCard.classList.add('store-skip');
    } else if (wished && qty === 0) {
      text = '★ WISHLIST · À PRENDRE';
      kind = 'wish';
      resultCard.classList.remove('store-skip');
    } else if (wished && qty > 0) {
      text = `★ WISHLIST · DÉJÀ ×${qty}`;
      kind = 'wish';
      resultCard.classList.remove('store-skip');
    } else if (qty > 0) {
      text = `✓ DÉJÀ POSSÉDÉE · ×${qty}`;
      kind = 'owned';
      resultCard.classList.remove('store-skip');
    } else {
      text = '🆕 NOUVELLE POUR TOI';
      kind = 'new';
      resultCard.classList.remove('store-skip');
    }

    status.className = `store-result-status ${kind}`;
    status.textContent = text;
    scanAgainBtn.textContent = '▦ Scanner la suivante';
    if (qty > 0) ownedBtn.textContent = `＋ Ajouter un exemplaire · ${qty} déjà`;
    else ownedBtn.textContent = '＋ Ajouter un exemplaire';
  }

  injectUi();
  active = sessionStorage.getItem('brickscan-store-mode') === '1';
  updateModeClasses();
  decorateResult();

  window.addEventListener('brickscan-collection-change', () => {
    updateWishlistCount();
    decorateResult();
  });
  window.addEventListener('storage', event => {
    if (['brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)) {
      updateWishlistCount();
      decorateResult();
    }
  });

  const observer = new MutationObserver(() => requestAnimationFrame(decorateResult));
  observer.observe(resultCard, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
  if (unknownCard) observer.observe(unknownCard, {attributes:true, attributeFilter:['class']});
})();
