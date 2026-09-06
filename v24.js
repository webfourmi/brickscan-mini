(() => {
  const APP_VERSION = '2.5.0';
  const LEGACY_NOTES_KEY = 'brickscan-notes';
  const COPY_NOTES_KEY = 'brickscan-copy-notes';
  const AUTO_KEY = 'brickscan-autobackup-v25';
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const validIds = new Set();
  const figureBySheetKey = new Map();

  for (const series of data) {
    for (const fig of series.figures || []) {
      validIds.add(fig.id);
      figureBySheetKey.set(`${series.name}::${fig.name}`, fig.id);
    }
  }

  const sheet = document.getElementById('figureSheet');
  const panel = sheet?.querySelector('.figure-sheet-panel');
  const wishlistBtn = document.getElementById('figureWishlistBtn');
  const grid = document.getElementById('collectionGrid');
  if (!sheet || !panel || !wishlistBtn || !grid) return;

  let currentId = null;
  let currentCopy = 0;
  let lastQty = 0;
  let saveTimer = null;
  let autoTimer = null;
  let decorating = false;
  let rendering = false;

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }

  function ownedSet() { return new Set(loadArray('brickscan-owned')); }

  function quantity(id) {
    const counts = loadObject('brickscan-counts');
    const n = Math.floor(Number(counts[id]) || 0);
    if (n > 0) return Math.min(99, n);
    return ownedSet().has(id) ? 1 : 0;
  }

  function getCurrentId() {
    const name = document.getElementById('figureSheetName')?.textContent?.trim() || '';
    const series = document.getElementById('figureSheetSeries')?.textContent?.trim() || '';
    return figureBySheetKey.get(`${series}::${name}`) || null;
  }

  function hasNote(note) {
    return Boolean(note && (
      String(note.condition || '').trim() ||
      String(note.missing || '').trim() ||
      String(note.text || '').trim()
    ));
  }

  function cleanNote(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const entry = {
      condition: String(raw.condition || '').slice(0, 40),
      missing: String(raw.missing || '').slice(0, 500),
      text: String(raw.text || '').slice(0, 3000),
      createdAt: raw.createdAt || raw.updatedAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
    return hasNote(entry) ? entry : {};
  }

  function sanitizeCopyNotes(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const [id, rawCopies] of Object.entries(input)) {
      if (!validIds.has(id) || !Array.isArray(rawCopies)) continue;
      const copies = rawCopies.slice(0, 99).map(raw => cleanNote(raw));
      if (copies.some(hasNote)) out[id] = copies;
    }
    return out;
  }

  function migrateLegacyNotes() {
    const legacy = loadObject(LEGACY_NOTES_KEY);
    if (!Object.keys(legacy).length) return;
    const copyNotes = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
    let changed = false;
    for (const [id, raw] of Object.entries(legacy)) {
      if (!validIds.has(id) || !hasNote(raw)) continue;
      if (!Array.isArray(copyNotes[id])) copyNotes[id] = [];
      if (!hasNote(copyNotes[id][0])) {
        copyNotes[id][0] = cleanNote(raw);
        changed = true;
      }
    }
    if (changed) localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(copyNotes));
  }

  function noteFor(id, index) {
    const all = loadObject(COPY_NOTES_KEY);
    return Array.isArray(all[id]) ? (all[id][index] || {}) : {};
  }

  function allCopyNotes(id) {
    const all = loadObject(COPY_NOTES_KEY);
    return Array.isArray(all[id]) ? all[id] : [];
  }

  function injectUi() {
    document.getElementById('figureNotesBox')?.remove();
    document.getElementById('figureNotesLocked')?.remove();
    document.getElementById('v24Styles')?.remove();

    const box = document.createElement('section');
    box.id = 'figureNotesBox';
    box.className = 'figure-notes-box hidden';
    box.innerHTML = `
      <div class="figure-notes-head">
        <div><strong>📝 Fiches de mes exemplaires</strong><small>Chaque doublon garde ses propres informations</small></div>
        <span id="figureNotesSaved" class="figure-notes-saved"></span>
      </div>
      <div id="figureCopyTabs" class="figure-copy-tabs" role="tablist" aria-label="Mes exemplaires"></div>
      <div class="figure-copy-title"><strong id="figureCopyTitle">Exemplaire 1</strong><span id="figureCopySummary"></span></div>
      <label class="figure-note-field">
        <span>État</span>
        <select id="figureCondition">
          <option value="">Non renseigné</option>
          <option value="comme-neuf">Comme neuf</option>
          <option value="tres-bon">Très bon état</option>
          <option value="bon">Bon état</option>
          <option value="use">Usé</option>
          <option value="restaurer">À restaurer</option>
        </select>
      </label>
      <label class="figure-note-field">
        <span>Accessoires manquants</span>
        <input id="figureMissingAccessories" type="text" autocomplete="off" placeholder="Ex. épée, socle, cape…">
      </label>
      <label class="figure-note-field">
        <span>Note libre</span>
        <textarea id="figureFreeNote" rows="3" placeholder="Rayure sur le torse, trouvé en brocante, pièce remplacée…"></textarea>
      </label>
    `;
    wishlistBtn.after(box);

    const hint = document.createElement('div');
    hint.id = 'figureNotesLocked';
    hint.className = 'figure-notes-locked';
    hint.textContent = '📝 Ajoute au moins un exemplaire à ta collection pour créer sa fiche.';
    box.after(hint);

    const style = document.createElement('style');
    style.id = 'v24Styles';
    style.textContent = `
      .figure-notes-box{display:grid;gap:11px;margin-top:12px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px}.figure-notes-box.hidden{display:none}
      .figure-notes-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.figure-notes-head>div{display:grid;gap:2px}.figure-notes-head small{font-size:10px;color:#6b7280}.figure-notes-saved{font-size:10px;color:#166534;font-weight:800;min-height:14px;white-space:nowrap}
      .figure-copy-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:thin}.figure-copy-tab{flex:0 0 auto;border:1px solid #d1d5db;background:#fff;color:#4b5563;border-radius:999px;padding:8px 11px;font:inherit;font-size:11px;font-weight:800}.figure-copy-tab.active{background:#111827;color:#fff;border-color:#111827}.figure-copy-tab.has-note::after{content:' · 📝';font-size:10px}.figure-copy-tab.inactive-copy{opacity:.52;border-style:dashed}
      .figure-copy-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:2px}.figure-copy-title strong{font-size:14px}.figure-copy-title span{font-size:10px;color:#6b7280;text-align:right}
      .figure-note-field{display:grid;gap:5px}.figure-note-field>span{font-size:11px;font-weight:800;color:#4b5563}.figure-note-field input,.figure-note-field select,.figure-note-field textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;background:#fff;border-radius:11px;padding:10px 11px;font:inherit;font-size:13px;color:#111827}.figure-note-field textarea{resize:vertical;min-height:76px}.figure-note-field input:focus,.figure-note-field select:focus,.figure-note-field textarea:focus{outline:2px solid rgba(17,24,39,.12);border-color:#9ca3af}
      .figure-notes-locked{margin-top:12px;padding:11px 12px;border-radius:13px;background:#f3f4f6;color:#6b7280;font-size:11px;line-height:1.4}.figure-notes-locked.hidden{display:none}
      .v24-note-badge{position:absolute;z-index:4;left:10px;bottom:10px;min-width:28px;height:28px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(17,24,39,.12)}
      @media(max-width:480px){.figure-notes-box{padding:12px}.figure-note-field input,.figure-note-field select,.figure-note-field textarea{font-size:16px}.figure-copy-tab{padding:8px 10px}}
    `;
    document.head.appendChild(style);

    document.getElementById('figureCopyTabs')?.addEventListener('click', event => {
      const btn = event.target.closest('button[data-copy-index]');
      if (!btn) return;
      flushPendingSave();
      currentCopy = Math.max(0, Number(btn.dataset.copyIndex) || 0);
      renderEditor(false);
    });

    ['figureCondition', 'figureMissingAccessories', 'figureFreeNote'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener(id === 'figureCondition' ? 'change' : 'input', scheduleSave);
    });
  }

  function copySummary(note) {
    const labels = {
      'comme-neuf':'Comme neuf',
      'tres-bon':'Très bon état',
      'bon':'Bon état',
      'use':'Usé',
      'restaurer':'À restaurer'
    };
    const bits = [];
    if (note?.condition) bits.push(labels[note.condition] || note.condition);
    if (note?.missing) bits.push('accessoires manquants');
    return bits.join(' · ') || 'Aucune information';
  }

  function renderTabs(id, qty) {
    const tabs = document.getElementById('figureCopyTabs');
    if (!tabs) return;
    const copies = allCopyNotes(id);
    const storedCount = copies.length;
    const count = Math.max(qty, storedCount > qty ? storedCount : 0);
    tabs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'figure-copy-tab';
      btn.dataset.copyIndex = String(i);
      btn.setAttribute('role', 'tab');
      btn.textContent = `Exemplaire ${i + 1}`;
      btn.classList.toggle('active', i === currentCopy);
      btn.classList.toggle('has-note', hasNote(copies[i]));
      btn.classList.toggle('inactive-copy', i >= qty);
      btn.disabled = i >= qty;
      btn.title = i >= qty ? 'Fiche conservée d’un ancien doublon. Réaugmente la quantité pour la réactiver.' : `Ouvrir la fiche de l’exemplaire ${i + 1}`;
      tabs.appendChild(btn);
    }
  }

  function renderEditor(autoSelectNew=true) {
    if (rendering) return;
    rendering = true;
    try {
      const nextId = getCurrentId();
      const box = document.getElementById('figureNotesBox');
      const locked = document.getElementById('figureNotesLocked');
      if (!box || !locked || !nextId) return;

      const qty = quantity(nextId);
      const changedFigure = currentId !== nextId;
      if (changedFigure) {
        flushPendingSave();
        currentId = nextId;
        currentCopy = 0;
        lastQty = qty;
      } else if (autoSelectNew && qty > lastQty && lastQty > 0) {
        flushPendingSave();
        currentCopy = qty - 1;
      }

      if (qty > 0 && currentCopy >= qty) currentCopy = Math.max(0, qty - 1);
      lastQty = qty;

      box.classList.toggle('hidden', qty < 1);
      locked.classList.toggle('hidden', qty > 0);
      if (qty < 1) return;

      renderTabs(currentId, qty);
      const note = noteFor(currentId, currentCopy);
      const condition = document.getElementById('figureCondition');
      const missing = document.getElementById('figureMissingAccessories');
      const text = document.getElementById('figureFreeNote');
      if (condition) condition.value = note.condition || '';
      if (missing) missing.value = note.missing || '';
      if (text) text.value = note.text || '';

      const title = document.getElementById('figureCopyTitle');
      const summary = document.getElementById('figureCopySummary');
      if (title) title.textContent = `Exemplaire ${currentCopy + 1}`;
      if (summary) summary.textContent = copySummary(note);
      const saved = document.getElementById('figureNotesSaved');
      if (saved) saved.textContent = '';
    } finally { rendering = false; }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = '…';
    const idAtEdit = currentId;
    const copyAtEdit = currentCopy;
    saveTimer = setTimeout(() => saveNote(idAtEdit, copyAtEdit), 300);
  }

  function flushPendingSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (currentId) saveNote(currentId, currentCopy);
  }

  function saveNote(id, copyIndex) {
    saveTimer = null;
    if (!id || copyIndex < 0) return;
    const qty = quantity(id);
    if (copyIndex >= qty) return;

    const all = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
    const copies = Array.isArray(all[id]) ? [...all[id]] : [];
    while (copies.length <= copyIndex) copies.push({});

    const previous = copies[copyIndex] || {};
    const entry = {
      condition: document.getElementById('figureCondition')?.value || '',
      missing: document.getElementById('figureMissingAccessories')?.value?.trim() || '',
      text: document.getElementById('figureFreeNote')?.value?.trim() || '',
      createdAt: previous.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    copies[copyIndex] = hasNote(entry) ? entry : {};

    if (copies.some(hasNote)) all[id] = copies;
    else delete all[id];
    localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(all));

    const saved = document.getElementById('figureNotesSaved');
    if (saved && id === currentId && copyIndex === currentCopy) saved.textContent = 'Enregistré ✓';
    const summary = document.getElementById('figureCopySummary');
    if (summary && id === currentId && copyIndex === currentCopy) summary.textContent = copySummary(entry);

    window.dispatchEvent(new CustomEvent('brickscan-notes-change', {detail:{id, copy:copyIndex}}));
    decorateCards();
    if (id === currentId) renderTabs(id, quantity(id));
    scheduleAutoBackup();
  }

  function decorateCards() {
    if (decorating) return;
    decorating = true;
    try {
      const notes = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
      const owned = ownedSet();
      grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
        const id = card.dataset.id;
        const activeQty = quantity(id);
        const notedCopies = Array.isArray(notes[id])
          ? notes[id].slice(0, activeQty).filter(hasNote).length
          : 0;
        let badge = card.querySelector('.v24-note-badge');
        if (owned.has(id) && notedCopies > 0) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'v24-note-badge';
            card.appendChild(badge);
          }
          badge.textContent = notedCopies > 1 ? `📝${notedCopies}` : '📝';
          badge.title = `${notedCopies} exemplaire${notedCopies > 1 ? 's' : ''} avec fiche renseignée`;
        } else badge?.remove();
      });
    } finally { decorating = false; }
  }

  function buildBackupPayload(automatic=false) {
    const copyNotes = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
    return {
      format: 'brickscan-mini-collection',
      formatVersion: 4,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      automatic,
      collection: {
        owned: loadArray('brickscan-owned'),
        counts: loadObject('brickscan-counts'),
        wishlist: loadArray('brickscan-wishlist'),
        copyNotes
      }
    };
  }

  function scheduleAutoBackup() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      try { localStorage.setItem(AUTO_KEY, JSON.stringify(buildBackupPayload(true))); } catch (_) {}
    }, 350);
  }

  function exportBackup() {
    flushPendingSave();
    const payload = buildBackupPayload(false);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `brickscan-collection-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const noted = Object.values(payload.collection.copyNotes).reduce((sum, copies) => sum + copies.filter(hasNote).length, 0);
    const status = document.getElementById('backupStatus');
    if (status) status.textContent = `Export V2.5 créé · ${noted} fiche(s) d’exemplaire renseignée(s).`;
  }

  function legacyNotesToCopies(legacyNotes) {
    const out = {};
    if (!legacyNotes || typeof legacyNotes !== 'object' || Array.isArray(legacyNotes)) return out;
    for (const [id, note] of Object.entries(legacyNotes)) {
      if (validIds.has(id) && hasNote(note)) out[id] = [cleanNote(note)];
    }
    return out;
  }

  function applyParsedBackup(parsed, label='ce fichier') {
    const collection = parsed?.collection && typeof parsed.collection === 'object' ? parsed.collection : null;
    const legacyOwned = Array.isArray(parsed) ? parsed : parsed?.owned;
    const owned = Array.isArray(collection?.owned) ? collection.owned : (Array.isArray(legacyOwned) ? legacyOwned : null);
    if (!owned) throw new Error('Format de sauvegarde non reconnu');

    const cleanOwned = [...new Set(owned.filter(id => validIds.has(id)))];
    const counts = collection?.counts && typeof collection.counts === 'object' ? collection.counts : {};
    const wishlist = Array.isArray(collection?.wishlist) ? collection.wishlist.filter(id => validIds.has(id)) : [];
    const copyNotes = collection?.copyNotes
      ? sanitizeCopyNotes(collection.copyNotes)
      : legacyNotesToCopies(collection?.notes || {});
    const noted = Object.values(copyNotes).reduce((sum, copies) => sum + copies.filter(hasNote).length, 0);

    if (!confirm(`Restaurer la collection depuis ${label} ?\n\n${cleanOwned.length} figurine(s), ${wishlist.length} souhait(s) et ${noted} fiche(s) d’exemplaire seront restaurés.`)) return;

    localStorage.setItem('brickscan-owned', JSON.stringify(cleanOwned));
    localStorage.setItem('brickscan-counts', JSON.stringify(counts));
    localStorage.setItem('brickscan-wishlist', JSON.stringify(wishlist));
    localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(copyNotes));
    localStorage.removeItem(LEGACY_NOTES_KEY);
    localStorage.setItem(AUTO_KEY, JSON.stringify(buildBackupPayload(true)));
    location.reload();
  }

  async function restoreFile(file) {
    if (!file) return;
    const text = await file.text();
    applyParsedBackup(JSON.parse(text), 'ce fichier');
  }

  function restoreAuto() {
    const raw = localStorage.getItem(AUTO_KEY)
      || localStorage.getItem('brickscan-autobackup-v24')
      || localStorage.getItem('brickscan-autobackup-v2');
    if (!raw) {
      const status = document.getElementById('backupStatus');
      if (status) status.textContent = 'Aucune sauvegarde automatique disponible.';
      return;
    }
    applyParsedBackup(JSON.parse(raw), 'la sauvegarde automatique');
  }

  function installBackupOverrides() {
    document.addEventListener('click', event => {
      const exportBtn = event.target.closest('#backupCollectionBtn');
      if (exportBtn) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        exportBackup(); return;
      }
      const restoreBtn = event.target.closest('#restoreCollectionBtn');
      if (restoreBtn) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        document.getElementById('restoreCollectionInput')?.click(); return;
      }
      const autoBtn = event.target.closest('#restoreAutoBackupBtn');
      if (autoBtn) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        restoreAuto();
      }
    }, true);

    document.addEventListener('change', event => {
      if (event.target?.id !== 'restoreCollectionInput') return;
      event.stopPropagation(); event.stopImmediatePropagation();
      restoreFile(event.target.files?.[0]).catch(error => {
        const status = document.getElementById('backupStatus');
        if (status) status.textContent = `Restauration impossible · ${error.message || 'fichier invalide'}`;
      }).finally(() => { event.target.value = ''; });
    }, true);
  }

  migrateLegacyNotes();
  injectUi();
  installBackupOverrides();

  const sheetObserver = new MutationObserver(() => {
    if (!sheet.classList.contains('hidden')) requestAnimationFrame(() => renderEditor(false));
  });
  sheetObserver.observe(sheet, {attributes:true, attributeFilter:['class'], childList:true, subtree:true});

  const gridObserver = new MutationObserver(() => requestAnimationFrame(decorateCards));
  gridObserver.observe(grid, {childList:true, subtree:true});

  window.addEventListener('brickscan-collection-change', () => {
    if (!sheet.classList.contains('hidden')) renderEditor(true);
    decorateCards();
    scheduleAutoBackup();
  });
  window.addEventListener('brickscan-notes-change', scheduleAutoBackup);
  window.addEventListener('storage', event => {
    if ([COPY_NOTES_KEY,LEGACY_NOTES_KEY,'brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)) {
      if (!sheet.classList.contains('hidden')) renderEditor(false);
      decorateCards();
      scheduleAutoBackup();
    }
  });
  window.addEventListener('beforeunload', flushPendingSave);

  decorateCards();
  scheduleAutoBackup();
})();
