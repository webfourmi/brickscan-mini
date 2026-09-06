(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const figIndex = new Map();
  const seriesIndex = new Map(data.map(series => [series.id, series]));

  for (const series of data) {
    for (const fig of series.figures || []) {
      figIndex.set(fig.id, {...fig, seriesId:series.id, seriesName:series.name, set:series.set, year:series.year});
    }
  }

  const searchForm = document.getElementById('collectionSearchForm');
  const searchInput = document.getElementById('collectionSearch');
  const searchClear = document.getElementById('collectionSearchClear');
  const ownershipFilters = document.getElementById('ownershipFilters');
  const visibleCount = document.getElementById('collectionVisibleCount');
  const seriesFilters = document.getElementById('seriesFilters');
  const grid = document.getElementById('collectionGrid');
  const empty = document.getElementById('collectionFilterEmpty');
  if (!searchForm || !searchInput || !searchClear || !ownershipFilters || !seriesFilters || !grid) return;

  let ownershipMode = 'all';
  let activeQuery = '';
  let scheduled = false;

  function readSet(key) {
    try { const raw = JSON.parse(localStorage.getItem(key) || '[]'); return new Set(Array.isArray(raw) ? raw : []); }
    catch (_) { return new Set(); }
  }
  function readObject(key) {
    try { const raw = JSON.parse(localStorage.getItem(key) || '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; }
    catch (_) { return {}; }
  }
  function ownedSet() { return readSet('brickscan-owned'); }
  function wishlistSet() { return readSet('brickscan-wishlist'); }
  function countsObject() { return readObject('brickscan-counts'); }
  function quantity(id) {
    const n = Math.floor(Number(countsObject()[id]) || 0);
    if (n > 0) return Math.min(99, n);
    return ownedSet().has(id) ? 1 : 0;
  }

  function ensureFilters() {
    let wish = ownershipFilters.querySelector('button[data-owned-filter="wishlist"]');
    if (!wish) {
      wish = document.createElement('button');
      wish.className = 'ownership-chip';
      wish.dataset.ownedFilter = 'wishlist';
      ownershipFilters.appendChild(wish);
    }
    let duplicates = ownershipFilters.querySelector('button[data-owned-filter="duplicates"]');
    if (!duplicates) {
      duplicates = document.createElement('button');
      duplicates.className = 'ownership-chip';
      duplicates.dataset.ownedFilter = 'duplicates';
      ownershipFilters.appendChild(duplicates);
    }
    return {wish, duplicates};
  }

  function ensureExportButton() {
    let button = document.getElementById('exportDuplicatesBtn');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'exportDuplicatesBtn';
    button.type = 'button';
    button.className = 'btn secondary';
    button.textContent = '↗ Exporter les doublons';
    button.style.display = 'none';
    button.style.marginTop = '8px';
    visibleCount?.after(button);
    button.addEventListener('click', exportDuplicatesCsv);
    return button;
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function matchesSearch(fig, query) {
    if (!query) return true;
    return normalize([fig?.name, fig?.name_en, fig?.seriesName, fig?.set, fig?.number].filter(Boolean).join(' ')).includes(query);
  }
  function updateClearButton() { searchClear.disabled = !searchInput.value && !activeQuery; }

  function decorateSeriesFilters(owned) {
    seriesFilters.querySelectorAll('button[data-filter]').forEach(button => {
      const id = button.dataset.filter;
      if (id === 'all') {
        const total = figIndex.size;
        const count = [...owned].filter(figId => figIndex.has(figId)).length;
        button.textContent = `Toutes · ${count}/${total}${total && count === total ? ' ✓' : ''}`;
        button.classList.toggle('series-complete', total > 0 && count === total);
        return;
      }
      const series = seriesIndex.get(id); if (!series) return;
      const total = (series.figures || []).length;
      const count = (series.figures || []).reduce((sum, fig) => sum + (owned.has(fig.id) ? 1 : 0), 0);
      button.textContent = `${series.name} · ${count}/${total}${total && count === total ? ' ✓' : ''}`;
      button.classList.toggle('series-complete', total > 0 && count === total);
    });
  }

  function decorateOwnershipFilters(wishlist) {
    const {wish, duplicates} = ensureFilters();
    const wishCount = [...wishlist].filter(id => figIndex.has(id)).length;
    const duplicateTypes = [...figIndex.keys()].filter(id => quantity(id) > 1).length;
    wish.textContent = `★ Wishlist · ${wishCount}`;
    duplicates.textContent = `♻ Doublons · ${duplicateTypes}`;
    ownershipFilters.querySelectorAll('button[data-owned-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.ownedFilter === ownershipMode);
    });
    const exportBtn = ensureExportButton();
    exportBtn.style.display = ownershipMode === 'duplicates' && duplicateTypes > 0 ? '' : 'none';
  }

  function applyFilters() {
    scheduled = false;
    const owned = ownedSet();
    const wishlist = wishlistSet();
    let shown = 0;
    let rendered = 0;

    grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
      rendered += 1;
      const id = card.dataset.id;
      const fig = figIndex.get(id);
      const isOwned = owned.has(id);
      const isWished = wishlist.has(id);
      const qty = quantity(id);
      const modeOk = ownershipMode === 'all'
        || (ownershipMode === 'owned' && isOwned)
        || (ownershipMode === 'missing' && !isOwned)
        || (ownershipMode === 'wishlist' && isWished)
        || (ownershipMode === 'duplicates' && qty > 1);
      const show = modeOk && matchesSearch(fig, activeQuery);
      card.classList.toggle('v19-hidden', !show);
      if (show) shown += 1;
    });

    decorateSeriesFilters(owned);
    decorateOwnershipFilters(wishlist);
    updateClearButton();

    if (visibleCount) {
      const modeLabel = ownershipMode === 'owned' ? 'possédée(s)'
        : ownershipMode === 'missing' ? 'manquante(s)'
        : ownershipMode === 'wishlist' ? 'dans la wishlist'
        : ownershipMode === 'duplicates' ? 'figurine(s) en double'
        : 'figurine(s)';
      visibleCount.textContent = `${shown} ${modeLabel}${activeQuery ? ` · recherche « ${searchInput.value.trim()} »` : ''}`;
    }
    if (empty) empty.classList.toggle('hidden', !(rendered > 0 && shown === 0));
  }

  function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function conditionLabel(value) {
    return ({'comme-neuf':'Comme neuf','tres-bon':'Très bon état','bon':'Bon état','use':'Usé','restaurer':'À restaurer'})[value] || 'Comme neuf';
  }
  function exportDuplicatesCsv() {
    const copyNotes = readObject('brickscan-copy-notes');
    const rows = [['Série','Figurine','Set','Quantité totale','Disponibles échange','Exemplaire','État','Accessoires manquants','Note']];

    for (const [id, fig] of figIndex.entries()) {
      const qty = quantity(id);
      if (qty < 2) continue;
      const notes = Array.isArray(copyNotes[id]) ? copyNotes[id] : [];
      for (let copyIndex = 1; copyIndex < qty; copyIndex++) {
        const note = notes[copyIndex] || {};
        rows.push([
          fig.seriesName || '', fig.name || '', fig.set || '', qty, qty - 1,
          copyIndex + 1, conditionLabel(note.condition), note.missing || '', note.text || ''
        ]);
      }
    }

    const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `brickscan-doublons-echanges-${date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyFilters);
  }

  searchForm.addEventListener('submit', event => { event.preventDefault(); activeQuery = normalize(searchInput.value); scheduleApply(); searchInput.blur(); });
  searchInput.addEventListener('input', updateClearButton);
  searchClear.addEventListener('click', () => { searchInput.value=''; activeQuery=''; scheduleApply(); searchInput.focus(); });

  ensureFilters(); ensureExportButton();
  ownershipFilters.addEventListener('click', event => {
    const button = event.target.closest('button[data-owned-filter]'); if (!button) return;
    ownershipMode = button.dataset.ownedFilter || 'all'; scheduleApply();
  });

  const observer = new MutationObserver(scheduleApply);
  observer.observe(seriesFilters,{childList:true,subtree:true});
  observer.observe(grid,{childList:true,subtree:true});
  window.addEventListener('storage', event => {
    if (['brickscan-owned','brickscan-counts','brickscan-wishlist','brickscan-copy-notes'].includes(event.key)) scheduleApply();
  });
  window.addEventListener('brickscan-collection-change', scheduleApply);
  window.addEventListener('brickscan-notes-change', scheduleApply);

  updateClearButton(); scheduleApply();
})();
