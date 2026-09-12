(() => {
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const collectionView = document.getElementById('collectionView');
  const stats = document.getElementById('collectionStats');
  if (!collectionView || !stats || !data.length) return;

  const figIndex = new Map();
  for (const series of data) {
    for (const fig of series.figures || []) {
      figIndex.set(fig.id, {...fig, seriesId:series.id, seriesName:series.name, set:series.set, year:series.year});
    }
  }

  const COUNTS_KEY = 'brickscan-counts';
  const OWNED_KEY = 'brickscan-owned';
  const NOTES_KEY = 'brickscan-copy-notes';
  const conditionLabels = {
    'comme-neuf':'Comme neuf',
    'tres-bon':'Très bon état',
    'bon':'Bon état',
    'use':'Usé',
    'restaurer':'À restaurer'
  };

  let activeList = 'duplicates';

  function loadArray(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }

  function quantity(id) {
    const counts = loadObject(COUNTS_KEY);
    const n = Math.floor(Number(counts[id]) || 0);
    if (n > 0) return Math.min(99, n);
    return loadArray(OWNED_KEY).includes(id) ? 1 : 0;
  }

  function normalizeNote(raw) {
    const note = raw && typeof raw === 'object' ? raw : {};
    return {
      condition: String(note.condition || 'comme-neuf'),
      missing: String(note.missing || '').trim(),
      text: String(note.text || '').trim()
    };
  }

  function notesFor(id) {
    const all = loadObject(NOTES_KEY);
    return Array.isArray(all[id]) ? all[id].map(normalizeNote) : [];
  }

  function duplicateRows() {
    const rows = [];
    for (const [id, fig] of figIndex) {
      const qty = quantity(id);
      if (qty < 2) continue;
      const notes = notesFor(id);
      const extras = [];
      for (let i = 1; i < qty; i++) {
        const note = notes[i] || normalizeNote({});
        extras.push({copy:i + 1, ...note});
      }
      rows.push({id, fig, qty, duplicateCount:qty - 1, extras});
    }
    return rows.sort((a,b) => a.fig.seriesName.localeCompare(b.fig.seriesName, 'fr', {numeric:true}) || (a.fig.number || 0) - (b.fig.number || 0));
  }

  function missingRows() {
    const rows = [];
    for (const [id, fig] of figIndex) {
      const qty = quantity(id);
      if (qty < 1) continue;
      const notes = notesFor(id);
      for (let i = 0; i < qty; i++) {
        const note = notes[i] || normalizeNote({});
        if (!note.missing) continue;
        rows.push({id, fig, copy:i + 1, ...note});
      }
    }
    return rows.sort((a,b) => a.fig.seriesName.localeCompare(b.fig.seriesName, 'fr', {numeric:true}) || (a.fig.number || 0) - (b.fig.number || 0) || a.copy - b.copy);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[c]));
  }

  function injectStyles() {
    if (document.getElementById('v210Styles')) return;
    const style = document.createElement('style');
    style.id = 'v210Styles';
    style.textContent = `
      .collection-lists-card{margin:12px 0 14px;padding:14px;border:1px solid #e5e7eb;border-radius:17px;background:#fff;display:grid;gap:11px}.collection-lists-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.collection-lists-head strong{display:block;font-size:14px}.collection-lists-head small{display:block;margin-top:2px;color:#6b7280;font-size:10px}.collection-list-buttons{display:grid;grid-template-columns:1fr 1fr;gap:9px}.collection-list-btn{border:1px solid #e5e7eb;background:#f9fafb;border-radius:14px;padding:11px;text-align:left;font:inherit;color:#111827}.collection-list-btn strong{display:block;font-size:13px}.collection-list-btn span{display:block;margin-top:3px;color:#6b7280;font-size:11px}.collection-list-btn .list-count{float:right;display:inline-grid;place-items:center;min-width:27px;height:27px;padding:0 7px;border-radius:999px;background:#111827;color:#fff;font-size:11px;font-weight:900}
      .collection-list-sheet{position:fixed;inset:0;z-index:1200;display:grid;align-items:end}.collection-list-sheet.hidden{display:none}.collection-list-backdrop{position:absolute;inset:0;background:rgba(17,24,39,.48)}.collection-list-panel{position:relative;z-index:1;max-height:82vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.18)}.collection-list-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;position:sticky;top:-18px;background:#fff;padding:4px 0 12px;z-index:2}.collection-list-sheet-head h2{margin:3px 0 0;font-size:20px}.collection-list-close{border:0;background:#f3f4f6;width:36px;height:36px;border-radius:50%;font-size:16px}.collection-list-toolbar{display:flex;gap:8px;margin-bottom:12px}.collection-list-toolbar .btn{flex:1}.collection-list-rows{display:grid;gap:9px}.collection-list-row{width:100%;box-sizing:border-box;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px;text-align:left;font:inherit;color:#111827}.collection-list-row:active{background:#f9fafb}.collection-list-row-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.collection-list-row strong{font-size:13px}.collection-list-row small{display:block;color:#6b7280;margin-top:3px;font-size:10px}.collection-list-badge{flex:0 0 auto;border-radius:999px;background:#eef2ff;color:#3730a3;padding:5px 8px;font-size:10px;font-weight:900}.collection-list-detail{margin-top:9px;padding-top:9px;border-top:1px solid #f3f4f6;font-size:11px;color:#4b5563;line-height:1.45}.collection-list-detail b{color:#111827}.collection-list-copy{display:block;margin-top:4px}.collection-list-empty{padding:26px 14px;text-align:center;border:1px dashed #d1d5db;border-radius:14px;color:#6b7280;font-size:12px}.collection-list-summary{font-size:11px;color:#6b7280;margin-bottom:10px}
      @media(max-width:420px){.collection-list-buttons{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    if (document.getElementById('collectionListsCard')) return;
    injectStyles();

    const card = document.createElement('section');
    card.id = 'collectionListsCard';
    card.className = 'collection-lists-card';
    card.innerHTML = `
      <div class="collection-lists-head"><div><strong>📋 Mes listes</strong><small>Doubles et accessoires à compléter</small></div></div>
      <div class="collection-list-buttons">
        <button id="duplicatesListBtn" class="collection-list-btn" type="button"><span id="duplicatesCount" class="list-count">0</span><strong>♻ Doubles</strong><span>Figurines en plusieurs exemplaires</span></button>
        <button id="missingAccessoriesListBtn" class="collection-list-btn" type="button"><span id="missingAccessoriesCount" class="list-count">0</span><strong>🧩 Accessoires manquants</strong><span>Exemplaires incomplets à compléter</span></button>
      </div>`;
    stats.insertAdjacentElement('afterend', card);

    const sheet = document.createElement('section');
    sheet.id = 'collectionListSheet';
    sheet.className = 'collection-list-sheet hidden';
    sheet.setAttribute('aria-hidden','true');
    sheet.innerHTML = `
      <div id="collectionListBackdrop" class="collection-list-backdrop"></div>
      <div class="collection-list-panel" role="dialog" aria-modal="true" aria-labelledby="collectionListTitle">
        <div class="collection-list-sheet-head"><div><div id="collectionListEyebrow" class="eyebrow">MES LISTES</div><h2 id="collectionListTitle"></h2></div><button id="collectionListClose" class="collection-list-close" type="button" aria-label="Fermer">✕</button></div>
        <div class="collection-list-toolbar"><button id="collectionListExport" class="btn secondary" type="button">⬇️ Exporter CSV</button></div>
        <div id="collectionListSummary" class="collection-list-summary"></div>
        <div id="collectionListRows" class="collection-list-rows"></div>
      </div>`;
    document.body.appendChild(sheet);

    document.getElementById('duplicatesListBtn')?.addEventListener('click', () => openList('duplicates'));
    document.getElementById('missingAccessoriesListBtn')?.addEventListener('click', () => openList('missing'));
    document.getElementById('collectionListClose')?.addEventListener('click', closeList);
    document.getElementById('collectionListBackdrop')?.addEventListener('click', closeList);
    document.getElementById('collectionListExport')?.addEventListener('click', exportActiveList);
    document.getElementById('collectionListRows')?.addEventListener('click', event => {
      const row = event.target.closest('[data-fig-id]');
      if (!row) return;
      openFigure(row.dataset.figId);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !sheet.classList.contains('hidden')) closeList();
    });
  }

  function refreshCounts() {
    const duplicates = duplicateRows();
    const missing = missingRows();
    const duplicateExtras = duplicates.reduce((sum,row) => sum + row.duplicateCount, 0);
    const d = document.getElementById('duplicatesCount');
    const m = document.getElementById('missingAccessoriesCount');
    if (d) d.textContent = String(duplicateExtras);
    if (m) m.textContent = String(missing.length);
    if (!document.getElementById('collectionListSheet')?.classList.contains('hidden')) renderActiveList();
  }

  function openList(type) {
    activeList = type;
    const sheet = document.getElementById('collectionListSheet');
    if (!sheet) return;
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    renderActiveList();
  }

  function closeList() {
    const sheet = document.getElementById('collectionListSheet');
    if (!sheet) return;
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  function duplicateDetail(row) {
    if (!row.extras.length) return '';
    return row.extras.map(extra => {
      const bits = [`Exemplaire ${extra.copy}`, conditionLabels[extra.condition] || extra.condition || 'Comme neuf'];
      if (extra.missing) bits.push(`manque : ${extra.missing}`);
      return `<span class="collection-list-copy">${esc(bits.join(' · '))}</span>`;
    }).join('');
  }

  function renderActiveList() {
    const rowsBox = document.getElementById('collectionListRows');
    const title = document.getElementById('collectionListTitle');
    const summary = document.getElementById('collectionListSummary');
    if (!rowsBox || !title || !summary) return;

    if (activeList === 'duplicates') {
      const rows = duplicateRows();
      const extras = rows.reduce((sum,row) => sum + row.duplicateCount, 0);
      title.textContent = '♻ Doubles';
      summary.textContent = rows.length ? `${extras} doublon${extras > 1 ? 's' : ''} réparti${extras > 1 ? 's' : ''} sur ${rows.length} figurine${rows.length > 1 ? 's' : ''}.` : 'Aucun doublon dans la collection.';
      rowsBox.innerHTML = rows.length ? rows.map(row => `
        <button type="button" class="collection-list-row" data-fig-id="${esc(row.id)}">
          <div class="collection-list-row-head"><div><strong>${esc(row.fig.name)}</strong><small>${esc(row.fig.seriesName)}${row.fig.set ? ` · set ${esc(row.fig.set)}` : ''}</small></div><span class="collection-list-badge">${row.qty} ex. · +${row.duplicateCount}</span></div>
          ${row.extras.length ? `<div class="collection-list-detail">${duplicateDetail(row)}</div>` : ''}
        </button>`).join('') : '<div class="collection-list-empty">Pas encore de doubles. Le jour où un clone apparaît, il atterrira ici. 🧱</div>';
    } else {
      const rows = missingRows();
      title.textContent = '🧩 Accessoires manquants';
      summary.textContent = rows.length ? `${rows.length} exemplaire${rows.length > 1 ? 's' : ''} avec des accessoires à compléter.` : 'Aucun accessoire manquant renseigné.';
      rowsBox.innerHTML = rows.length ? rows.map(row => `
        <button type="button" class="collection-list-row" data-fig-id="${esc(row.id)}">
          <div class="collection-list-row-head"><div><strong>${esc(row.fig.name)}</strong><small>${esc(row.fig.seriesName)}${row.fig.set ? ` · set ${esc(row.fig.set)}` : ''} · exemplaire ${row.copy}</small></div><span class="collection-list-badge">🧩</span></div>
          <div class="collection-list-detail"><b>Manque :</b> ${esc(row.missing)}${row.text ? `<span class="collection-list-copy">Note : ${esc(row.text)}</span>` : ''}</div>
        </button>`).join('') : '<div class="collection-list-empty">Tout ce qui est renseigné dans la collection est complet. ✨</div>';
    }
  }

  function openFigure(id) {
    closeList();
    const cards = [...document.querySelectorAll('#collectionGrid .fig-card[data-id]')];
    const card = cards.find(item => item.dataset.id === id);
    if (card) {
      card.click();
      return;
    }
    const fig = figIndex.get(id);
    if (!fig) return;
    const search = document.getElementById('collectionSearch');
    if (search) {
      search.value = fig.name;
      search.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g,'""')}"`;
  }

  function downloadCsv(filename, header, rows) {
    const csv = '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportActiveList() {
    if (activeList === 'duplicates') {
      const rows = duplicateRows();
      downloadCsv('brickscan-doubles.csv', ['Série','Set','Figurine','Quantité','Nombre de doubles','Détails des doubles'], rows.map(row => [
        row.fig.seriesName, row.fig.set || '', row.fig.name, row.qty, row.duplicateCount,
        row.extras.map(extra => `Exemplaire ${extra.copy}: ${conditionLabels[extra.condition] || extra.condition}${extra.missing ? `; manque ${extra.missing}` : ''}`).join(' | ')
      ]));
    } else {
      const rows = missingRows();
      downloadCsv('brickscan-accessoires-manquants.csv', ['Série','Set','Figurine','Exemplaire','Accessoires manquants','État','Note'], rows.map(row => [
        row.fig.seriesName, row.fig.set || '', row.fig.name, row.copy, row.missing, conditionLabels[row.condition] || row.condition, row.text
      ]));
    }
  }

  injectUi();
  refreshCounts();

  window.addEventListener('brickscan-collection-change', refreshCounts);
  window.addEventListener('brickscan-notes-change', refreshCounts);
  window.addEventListener('storage', event => {
    if ([COUNTS_KEY, OWNED_KEY, NOTES_KEY].includes(event.key)) refreshCounts();
  });
})();