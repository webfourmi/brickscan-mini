(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const figIndex = new Map();
  const nameIndex = new Map();
  const seriesIndex = new Map(data.map(series => [series.id, series]));

  for (const series of data) {
    for (const fig of series.figures || []) {
      const full = {...fig, seriesId:series.id, seriesName:series.name, set:series.set, year:series.year, scannable:series.scannable};
      figIndex.set(fig.id, full);
      nameIndex.set(fig.name, full);
    }
  }

  const grid = document.getElementById('collectionGrid');
  const sheet = document.getElementById('figureSheet');
  const sheetClose = document.getElementById('figureSheetClose');
  const sheetBackdrop = document.getElementById('figureSheetBackdrop');
  const qtyMinus = document.getElementById('figureQtyMinus');
  const qtyPlus = document.getElementById('figureQtyPlus');
  const wishlistBtn = document.getElementById('figureWishlistBtn');
  const clearCollection = document.getElementById('clearCollection');
  const ownedBtn = document.getElementById('ownedBtn');
  if (!grid || !sheet) return;

  const PHOTO_BASE = 'https://raw.githubusercontent.com/le0pard/lego-scanner/main/src/lib/assets/minifigures/';
  const folderMap = {'dnd':'dungeons-and-dragons','spiderverse':'spiderman-spiderverse'};
  const fileOverrides = {'spiderverse-10':'peter-b-parker-spider-man-may-mayday-parkern.jpg'};
  let currentFigId = null;
  let decorating = false;

  function loadArray(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  }
  function loadObject(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (_) { return {}; }
  }
  function ownedSet() { return new Set(loadArray('brickscan-owned').filter(id => figIndex.has(id))); }
  function wishlistSet() { return new Set(loadArray('brickscan-wishlist').filter(id => figIndex.has(id))); }
  function countsObject() { return loadObject('brickscan-counts'); }

  function migrateCounts() {
    const owned = ownedSet();
    const counts = countsObject();
    let changed = false;
    for (const id of owned) {
      if (!Number.isInteger(Number(counts[id])) || Number(counts[id]) < 1) {
        counts[id] = 1;
        changed = true;
      }
    }
    for (const [id, value] of Object.entries(counts)) {
      if (!figIndex.has(id) || !Number.isFinite(Number(value)) || Number(value) < 1) {
        delete counts[id];
        changed = true;
      } else {
        counts[id] = Math.min(99, Math.floor(Number(value)));
      }
    }
    if (changed) localStorage.setItem('brickscan-counts', JSON.stringify(counts));
  }

  function quantity(id) {
    const counts = countsObject();
    const n = Math.floor(Number(counts[id]) || 0);
    if (n > 0) return Math.min(99, n);
    return ownedSet().has(id) ? 1 : 0;
  }

  function notifyChange() {
    window.dispatchEvent(new CustomEvent('brickscan-collection-change'));
    scheduleDecorate();
  }

  function setQuantity(id, value) {
    if (!figIndex.has(id)) return;
    const qty = Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
    const counts = countsObject();
    const owned = ownedSet();
    if (qty > 0) {
      counts[id] = qty;
      owned.add(id);
    } else {
      delete counts[id];
      owned.delete(id);
    }
    localStorage.setItem('brickscan-counts', JSON.stringify(counts));
    localStorage.setItem('brickscan-owned', JSON.stringify([...owned]));
    notifyChange();
  }

  function toggleWishlist(id) {
    const wishlist = wishlistSet();
    wishlist.has(id) ? wishlist.delete(id) : wishlist.add(id);
    localStorage.setItem('brickscan-wishlist', JSON.stringify([...wishlist]));
    notifyChange();
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/&/g, ' ').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }
  function photoUrl(fig) {
    if (!fig) return '';
    if (fig.image) return fig.image;
    const n = Number(fig.seriesId?.split('-')[1]);
    if (Number.isFinite(n) && n < 25) return '';
    const folder = folderMap[fig.seriesId] || fig.seriesId;
    const filename = fileOverrides[fig.id] || `${slugify(fig.name_en || fig.name)}.jpg`;
    return `${PHOTO_BASE}${folder}/${filename}`;
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function renderSheet() {
    const fig = figIndex.get(currentFigId);
    if (!fig) return;
    const series = seriesIndex.get(fig.seriesId) || {};
    const qty = quantity(fig.id);
    const wished = wishlistSet().has(fig.id);
    const url = photoUrl(fig);
    const codes = Array.isArray(fig.codes) ? fig.codes.filter(Boolean) : [];

    const image = document.getElementById('figureSheetImage');
    const fallback = document.getElementById('figureSheetFallback');
    if (image && fallback) {
      if (url) {
        image.src = url;
        image.alt = `Figurine ${fig.name}`;
        image.classList.remove('hidden');
        fallback.classList.add('hidden');
        image.onerror = () => { image.classList.add('hidden'); fallback.classList.remove('hidden'); };
      } else {
        image.removeAttribute('src');
        image.classList.add('hidden');
        fallback.textContent = fig.number || '◆';
        fallback.classList.remove('hidden');
      }
    }

    document.getElementById('figureSheetName').textContent = fig.name || '';
    document.getElementById('figureSheetSeries').textContent = fig.seriesName || '';
    document.getElementById('figureSheetNumber').textContent = fig.number ?? '—';
    document.getElementById('figureSheetSet').textContent = fig.set || '—';
    document.getElementById('figureSheetYear').textContent = series.year || fig.year || '—';
    document.getElementById('figureSheetScan').textContent = codes.length ? `${codes.length} code${codes.length > 1 ? 's' : ''} connu${codes.length > 1 ? 's' : ''}` : 'Gestion manuelle';
    document.getElementById('figureQtyValue').textContent = qty;
    document.getElementById('figureOwnedState').textContent = qty > 0 ? (qty === 1 ? '1 exemplaire dans la collection' : `${qty} exemplaires dans la collection`) : 'Pas encore dans la collection';
    wishlistBtn.textContent = wished ? '★ Dans ma wishlist' : '☆ Ajouter à ma wishlist';
    wishlistBtn.classList.toggle('wish-active', wished);

    const codesBox = document.getElementById('figureSheetCodes');
    if (codesBox) {
      codesBox.innerHTML = codes.length
        ? `<strong>Codes Data Matrix connus</strong><div class="figure-code-list">${codes.map(code => `<span>${esc(code)}</span>`).join('')}</div>`
        : '<strong>Codes Data Matrix</strong><p>Pas de code moderne activé pour cette figurine.</p>';
    }
  }

  function openSheet(id) {
    if (!figIndex.has(id)) return;
    currentFigId = id;
    renderSheet();
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('figure-sheet-open');
    setTimeout(() => sheetClose?.focus(), 20);
  }
  function closeSheet() {
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('figure-sheet-open');
    currentFigId = null;
  }

  function decorateCards() {
    const wishlist = wishlistSet();
    grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
      const id = card.dataset.id;
      const qty = quantity(id);
      card.classList.toggle('owned', qty > 0);
      let mark = card.querySelector('.owned-mark');
      if (qty > 0 && !mark) {
        mark = document.createElement('div');
        mark.className = 'owned-mark';
        mark.textContent = '✓';
        card.appendChild(mark);
      } else if (qty === 0) mark?.remove();

      let qtyBadge = card.querySelector('.v20-qty-badge');
      if (qty > 1) {
        if (!qtyBadge) { qtyBadge = document.createElement('div'); qtyBadge.className = 'v20-qty-badge'; card.appendChild(qtyBadge); }
        if (qtyBadge.textContent !== `×${qty}`) qtyBadge.textContent = `×${qty}`;
      } else qtyBadge?.remove();

      let wishBadge = card.querySelector('.v20-wish-badge');
      if (wishlist.has(id)) {
        if (!wishBadge) { wishBadge = document.createElement('div'); wishBadge.className = 'v20-wish-badge'; wishBadge.textContent = '★'; card.appendChild(wishBadge); }
      } else wishBadge?.remove();
      card.setAttribute('aria-label', `${figIndex.get(id)?.name || 'Figurine'} · ouvrir la fiche`);
    });
  }

  function decorateStats() {
    const stats = document.getElementById('collectionStats');
    if (!stats) return;
    const counts = countsObject();
    const owned = ownedSet();
    const wishlist = wishlistSet();
    const totalCopies = [...owned].reduce((sum, id) => sum + Math.max(1, Number(counts[id]) || 1), 0);
    const extras = [...owned].reduce((sum, id) => sum + Math.max(0, (Number(counts[id]) || 1) - 1), 0);
    const topStrong = stats.querySelector('.stats-top strong');
    if (topStrong) topStrong.textContent = `${owned.size} / ${figIndex.size}`;
    const progress = stats.querySelector('.progress span');
    if (progress) progress.style.width = `${figIndex.size ? owned.size / figIndex.size * 100 : 0}%`;
    let extra = stats.querySelector('.v20-stats-extra');
    if (!extra) { extra = document.createElement('div'); extra.className = 'v20-stats-extra'; stats.appendChild(extra); }
    const html = `<span>${totalCopies} exemplaire${totalCopies !== 1 ? 's' : ''}</span><span>${extras} doublon${extras !== 1 ? 's' : ''}</span><span>${wishlist.size} souhait${wishlist.size !== 1 ? 's' : ''} ★</span>`;
    if (extra.innerHTML !== html) extra.innerHTML = html;
  }

  function decorateResultButton() {
    if (!ownedBtn) return;
    const card = document.getElementById('resultCard');
    if (!card || card.classList.contains('hidden')) return;
    const fig = nameIndex.get(document.getElementById('resultName')?.textContent?.trim());
    if (!fig) return;
    const qty = quantity(fig.id);
    const label = qty > 0 ? `＋ Ajouter un exemplaire · ${qty} déjà` : '＋ Ajouter à ma collection';
    if (ownedBtn.textContent !== label) ownedBtn.textContent = label;
    ownedBtn.classList.add('primary');
    ownedBtn.classList.remove('secondary');
  }

  function decorateAll() {
    if (decorating) return;
    decorating = true;
    try { decorateCards(); decorateStats(); decorateResultButton(); if (currentFigId) renderSheet(); }
    finally { decorating = false; }
  }
  let scheduled = false;
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorateAll(); });
  }

  migrateCounts();

  grid.addEventListener('click', event => {
    const card = event.target.closest('.fig-card[data-id]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openSheet(card.dataset.id);
  }, true);

  qtyMinus?.addEventListener('click', () => { if (currentFigId) setQuantity(currentFigId, quantity(currentFigId) - 1); });
  qtyPlus?.addEventListener('click', () => { if (currentFigId) setQuantity(currentFigId, quantity(currentFigId) + 1); });
  wishlistBtn?.addEventListener('click', () => { if (currentFigId) toggleWishlist(currentFigId); });
  sheetClose?.addEventListener('click', closeSheet);
  sheetBackdrop?.addEventListener('click', closeSheet);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheet.classList.contains('hidden')) closeSheet(); });

  ownedBtn?.addEventListener('click', event => {
    const card = document.getElementById('resultCard');
    if (!card || card.classList.contains('hidden')) return;
    const fig = nameIndex.get(document.getElementById('resultName')?.textContent?.trim());
    if (!fig) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setQuantity(fig.id, quantity(fig.id) + 1);
  }, true);

  clearCollection?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!confirm('Vider toute la collection et les quantités ? La wishlist sera conservée.')) return;
    localStorage.setItem('brickscan-owned', '[]');
    localStorage.setItem('brickscan-counts', '{}');
    notifyChange();
  }, true);

  window.addEventListener('brickscan-collection-change', scheduleDecorate);
  window.addEventListener('storage', event => {
    if (['brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)) scheduleDecorate();
  });

  const gridObserver = new MutationObserver(scheduleDecorate);
  gridObserver.observe(grid, {childList:true, subtree:true});
  const result = document.getElementById('resultCard');
  if (result) {
    const resultObserver = new MutationObserver(scheduleDecorate);
    resultObserver.observe(result, {attributes:true, attributeFilter:['class']});
  }

  scheduleDecorate();
})();
