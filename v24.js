(() => {
  const APP_VERSION = '2.4.0';
  const NOTES_KEY = 'brickscan-notes';
  const AUTO_KEY = 'brickscan-autobackup-v24';
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
  let saveTimer = null;
  let autoTimer = null;
  let decorating = false;

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

  function sanitizeNotes(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const [id, raw] of Object.entries(input)) {
      if (!validIds.has(id) || !raw || typeof raw !== 'object') continue;
      const entry = {
        condition: String(raw.condition || '').slice(0, 40),
        missing: String(raw.missing || '').slice(0, 500),
        text: String(raw.text || '').slice(0, 3000),
        updatedAt: raw.updatedAt || new Date().toISOString()
      };
      if (hasNote(entry)) out[id] = entry;
    }
    return out;
  }

  function injectUi() {
    if (document.getElementById('figureNotesBox')) return;

    const box = document.createElement('section');
    box.id = 'figureNotesBox';
    box.className = 'figure-notes-box hidden';
    box.innerHTML = `
      <div class="figure-notes-head">
        <div><strong>📝 Notes de collection</strong><small>Enregistrement automatique</small></div>
        <span id="figureNotesSaved" class="figure-notes-saved"></span>
      </div>
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
        <textarea id="figureFreeNote" rows="3" placeholder="Rayure sur le torse, à remplacer, trouvé en brocante…"></textarea>
      </label>
    `;
    wishlistBtn.after(box);

    const hint = document.createElement('div');
    hint.id = 'figureNotesLocked';
    hint.className = 'figure-notes-locked';
    hint.textContent = '📝 Ajoute au moins un exemplaire à ta collection pour renseigner son état.';
    box.after(hint);

    const style = document.createElement('style');
    style.id = 'v24Styles';
    style.textContent = `
      .figure-notes-box{display:grid;gap:11px;margin-top:12px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px}.figure-notes-box.hidden{display:none}
      .figure-notes-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.figure-notes-head>div{display:grid;gap:2px}.figure-notes-head small{font-size:10px;color:#6b7280}.figure-notes-saved{font-size:10px;color:#166534;font-weight:800;min-height:14px}
      .figure-note-field{display:grid;gap:5px}.figure-note-field>span{font-size:11px;font-weight:800;color:#4b5563}.figure-note-field input,.figure-note-field select,.figure-note-field textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;background:#fff;border-radius:11px;padding:10px 11px;font:inherit;font-size:13px;color:#111827}.figure-note-field textarea{resize:vertical;min-height:76px}.figure-note-field input:focus,.figure-note-field select:focus,.figure-note-field textarea:focus{outline:2px solid rgba(17,24,39,.12);border-color:#9ca3af}
      .figure-notes-locked{margin-top:12px;padding:11px 12px;border-radius:13px;background:#f3f4f6;color:#6b7280;font-size:11px;line-height:1.4}.figure-notes-locked.hidden{display:none}
      .v24-note-badge{position:absolute;z-index:4;left:10px;bottom:10px;min-width:28px;height:28px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;font-size:12px;font-weight:900;box-shadow:0 2px 8px rgba(17,24,39,.12)}
      @media(max-width:480px){.figure-notes-box{padding:12px}.figure-note-field input,.figure-note-field select,.figure-note-field textarea{font-size:16px}}
    `;
    document.head.appendChild(style);

    ['figureCondition', 'figureMissingAccessories', 'figureFreeNote'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener(id === 'figureCondition' ? 'change' : 'input', scheduleSave);
    });
  }

  function readNote(id) { return loadObject(NOTES_KEY)[id] || {}; }

  function renderEditor() {
    currentId = getCurrentId();
    const box = document.getElementById('figureNotesBox');
    const locked = document.getElementById('figureNotesLocked');
    if (!box || !locked || !currentId) return;

    const owned = ownedSet().has(currentId);
    box.classList.toggle('hidden', !owned);
    locked.classList.toggle('hidden', owned);
    if (!owned) return;

    const note = readNote(currentId);
    const condition = document.getElementById('figureCondition');
    const missing = document.getElementById('figureMissingAccessories');
    const text = document.getElementById('figureFreeNote');
    if (condition && condition.value !== (note.condition || '')) condition.value = note.condition || '';
    if (missing && missing.value !== (note.missing || '')) missing.value = note.missing || '';
    if (text && text.value !== (note.text || '')) text.value = note.text || '';
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = '…';
    saveTimer = setTimeout(saveCurrentNote, 300);
  }

  function saveCurrentNote() {
    if (!currentId || !ownedSet().has(currentId)) return;
    const notes = loadObject(NOTES_KEY);
    const entry = {
      condition: document.getElementById('figureCondition')?.value || '',
      missing: document.getElementById('figureMissingAccessories')?.value?.trim() || '',
      text: document.getElementById('figureFreeNote')?.value?.trim() || '',
      updatedAt: new Date().toISOString()
    };

    if (hasNote(entry)) notes[currentId] = entry;
    else delete notes[currentId];

    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = 'Enregistré ✓';
    window.dispatchEvent(new CustomEvent('brickscan-notes-change', {detail:{id:currentId}}));
    decorateCards();
    scheduleAutoBackup();
  }

  function decorateCards() {
    if (decorating) return;
    decorating = true;
    try {
      const notes = loadObject(NOTES_KEY);
      const owned = ownedSet();
      grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
        const id = card.dataset.id;
        let badge = card.querySelector('.v24-note-badge');
        if (owned.has(id) && hasNote(notes[id])) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'v24-note-badge';
            badge.textContent = '📝';
            badge.title = 'Notes enregistrées';
            card.appendChild(badge);
          }
        } else badge?.remove();
      });
    } finally { decorating = false; }
  }

  function buildBackupPayload(automatic=false) {
    return {
      format: 'brickscan-mini-collection',
      formatVersion: 3,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      automatic,
      collection: {
        owned: loadArray('brickscan-owned'),
        counts: loadObject('brickscan-counts'),
        wishlist: loadArray('brickscan-wishlist'),
        notes: sanitizeNotes(loadObject(NOTES_KEY))
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
    const status = document.getElementById('backupStatus');
    if (status) status.textContent = `Export V2.4 créé · ${Object.keys(payload.collection.notes).length} fiche(s) avec notes.`;
  }

  function applyParsedBackup(parsed, label='ce fichier') {
    const collection = parsed?.collection && typeof parsed.collection === 'object' ? parsed.collection : null;
    const legacyOwned = Array.isArray(parsed) ? parsed : parsed?.owned;
    const owned = Array.isArray(collection?.owned) ? collection.owned : (Array.isArray(legacyOwned) ? legacyOwned : null);
    if (!owned) throw new Error('Format de sauvegarde non reconnu');

    const cleanOwned = [...new Set(owned.filter(id => validIds.has(id)))];
    const counts = collection?.counts && typeof collection.counts === 'object' ? collection.counts : {};
    const wishlist = Array.isArray(collection?.wishlist) ? collection.wishlist.filter(id => validIds.has(id)) : [];
    const notes = sanitizeNotes(collection?.notes || {});

    if (!confirm(`Restaurer la collection depuis ${label} ?\n\n${cleanOwned.length} figurine(s), ${wishlist.length} souhait(s) et ${Object.keys(notes).length} fiche(s) avec notes seront restaurés.`)) return;

    localStorage.setItem('brickscan-owned', JSON.stringify(cleanOwned));
    localStorage.setItem('brickscan-counts', JSON.stringify(counts));
    localStorage.setItem('brickscan-wishlist', JSON.stringify(wishlist));
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    localStorage.setItem(AUTO_KEY, JSON.stringify(buildBackupPayload(true)));
    location.reload();
  }

  async function restoreFile(file) {
    if (!file) return;
    const text = await file.text();
    applyParsedBackup(JSON.parse(text), 'ce fichier');
  }

  function restoreAuto() {
    const raw = localStorage.getItem(AUTO_KEY) || localStorage.getItem('brickscan-autobackup-v2');
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

  injectUi();
  installBackupOverrides();

  const sheetObserver = new MutationObserver(() => {
    if (!sheet.classList.contains('hidden')) requestAnimationFrame(renderEditor);
  });
  sheetObserver.observe(sheet, {attributes:true, attributeFilter:['class'], childList:true, subtree:true});

  const gridObserver = new MutationObserver(() => requestAnimationFrame(decorateCards));
  gridObserver.observe(grid, {childList:true, subtree:true});

  window.addEventListener('brickscan-collection-change', () => {
    renderEditor(); decorateCards(); scheduleAutoBackup();
  });
  window.addEventListener('brickscan-notes-change', scheduleAutoBackup);
  window.addEventListener('storage', event => {
    if ([NOTES_KEY,'brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)) {
      renderEditor(); decorateCards(); scheduleAutoBackup();
    }
  });

  decorateCards();
  scheduleAutoBackup();
})();
