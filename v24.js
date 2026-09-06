(() => {
  const APP_VERSION = '2.6.0';
  const LEGACY_NOTES_KEY = 'brickscan-notes';
  const COPY_NOTES_KEY = 'brickscan-copy-notes';
  const AUTO_KEY = 'brickscan-autobackup-v26';
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
  const wishlistBtn = document.getElementById('figureWishlistBtn');
  const grid = document.getElementById('collectionGrid');
  if (!sheet || !wishlistBtn || !grid) return;

  let currentId = null;
  let currentCopy = 0;
  let lastQty = 0;
  let saveTimer = null;
  let autoTimer = null;
  let decorating = false;

  function loadArray(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  }
  function loadObject(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (_) { return {}; }
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
  function hasCustomInfo(note) {
    return Boolean(note && (
      (note.condition && note.condition !== 'comme-neuf') ||
      String(note.missing || '').trim() ||
      String(note.text || '').trim()
    ));
  }
  function normalizeNote(raw) {
    const note = raw && typeof raw === 'object' ? raw : {};
    return {
      condition: String(note.condition || 'comme-neuf').slice(0, 40),
      missing: String(note.missing || '').slice(0, 500),
      text: String(note.text || '').slice(0, 3000),
      createdAt: note.createdAt || note.updatedAt || '',
      updatedAt: note.updatedAt || ''
    };
  }
  function sanitizeCopyNotes(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const [id, rawCopies] of Object.entries(input)) {
      if (!validIds.has(id) || !Array.isArray(rawCopies)) continue;
      const copies = rawCopies.slice(0, 99).map(normalizeNote);
      if (copies.some(note => note.createdAt || note.updatedAt || hasCustomInfo(note))) out[id] = copies;
    }
    return out;
  }
  function migrateLegacyNotes() {
    const legacy = loadObject(LEGACY_NOTES_KEY);
    if (!Object.keys(legacy).length) return;
    const all = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
    let changed = false;
    for (const [id, raw] of Object.entries(legacy)) {
      if (!validIds.has(id) || !raw || typeof raw !== 'object') continue;
      if (!Array.isArray(all[id])) all[id] = [];
      if (!all[id][0]?.updatedAt && !hasCustomInfo(all[id][0])) {
        all[id][0] = normalizeNote(raw);
        changed = true;
      }
    }
    if (changed) localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(all));
  }
  function allCopyNotes(id) {
    const all = loadObject(COPY_NOTES_KEY);
    return Array.isArray(all[id]) ? all[id].map(normalizeNote) : [];
  }
  function noteFor(id, index) {
    return allCopyNotes(id)[index] || normalizeNote({});
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
        <div><strong>📝 Fiches de mes exemplaires</strong><small>Chaque doublon a sa propre fiche</small></div>
        <span id="figureNotesSaved" class="figure-notes-saved"></span>
      </div>
      <div id="figureCopyTabs" class="figure-copy-tabs" role="tablist" aria-label="Mes exemplaires"></div>
      <div class="figure-copy-title"><strong id="figureCopyTitle">Exemplaire 1</strong><span id="figureCopySummary"></span></div>
      <label class="figure-note-field"><span>État</span><select id="figureCondition">
        <option value="comme-neuf">Comme neuf</option>
        <option value="tres-bon">Très bon état</option>
        <option value="bon">Bon état</option>
        <option value="use">Usé</option>
        <option value="restaurer">À restaurer</option>
      </select></label>
      <label class="figure-note-field"><span>Accessoires manquants</span><input id="figureMissingAccessories" type="text" autocomplete="off" placeholder="Ex. épée, socle, cape…"></label>
      <label class="figure-note-field"><span>Note libre</span><textarea id="figureFreeNote" rows="3" placeholder="Rayure sur le torse, provenance, pièce remplacée…"></textarea></label>
    `;
    wishlistBtn.after(box);

    const locked = document.createElement('div');
    locked.id = 'figureNotesLocked';
    locked.className = 'figure-notes-locked';
    locked.textContent = '📝 Ajoute au moins un exemplaire à ta collection pour créer sa fiche.';
    box.after(locked);

    const style = document.createElement('style');
    style.id = 'v24Styles';
    style.textContent = `
      .figure-notes-box{display:grid;gap:11px;margin-top:12px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px}.figure-notes-box.hidden{display:none}
      .figure-notes-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.figure-notes-head>div{display:grid;gap:2px}.figure-notes-head small{font-size:10px;color:#6b7280}.figure-notes-saved{font-size:10px;color:#166534;font-weight:800;min-height:14px;white-space:nowrap}
      .figure-copy-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 4px}.figure-copy-tab{flex:0 0 auto;border:1px solid #d1d5db;background:#fff;color:#4b5563;border-radius:999px;padding:8px 11px;font:inherit;font-size:11px;font-weight:800}.figure-copy-tab.active{background:#111827;color:#fff;border-color:#111827}.figure-copy-tab.has-note::after{content:' · 📝';font-size:10px}.figure-copy-tab.inactive-copy{opacity:.5;border-style:dashed}
      .figure-copy-title{display:flex;justify-content:space-between;gap:10px}.figure-copy-title strong{font-size:14px}.figure-copy-title span{font-size:10px;color:#6b7280;text-align:right}
      .figure-note-field{display:grid;gap:5px}.figure-note-field>span{font-size:11px;font-weight:800;color:#4b5563}.figure-note-field input,.figure-note-field select,.figure-note-field textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;background:#fff;border-radius:11px;padding:10px 11px;font:inherit;font-size:16px;color:#111827}.figure-note-field textarea{resize:vertical;min-height:84px}.figure-note-field input:focus,.figure-note-field select:focus,.figure-note-field textarea:focus{outline:2px solid rgba(17,24,39,.12);border-color:#9ca3af}
      .figure-notes-locked{margin-top:12px;padding:11px 12px;border-radius:13px;background:#f3f4f6;color:#6b7280;font-size:11px}.figure-notes-locked.hidden{display:none}
      .v24-note-badge{position:absolute;z-index:4;left:10px;bottom:10px;min-width:28px;height:28px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(17,24,39,.12)}
    `;
    document.head.appendChild(style);

    document.getElementById('figureCopyTabs')?.addEventListener('click', event => {
      const btn = event.target.closest('button[data-copy-index]');
      if (!btn || btn.disabled) return;
      flushPendingSave();
      currentCopy = Number(btn.dataset.copyIndex) || 0;
      renderEditor(false);
    });
    document.getElementById('figureCondition')?.addEventListener('change', saveCurrentImmediately);
    document.getElementById('figureMissingAccessories')?.addEventListener('input', scheduleSave);
    document.getElementById('figureFreeNote')?.addEventListener('input', scheduleSave);
  }

  const conditionLabels = {
    'comme-neuf':'Comme neuf','tres-bon':'Très bon état','bon':'Bon état','use':'Usé','restaurer':'À restaurer'
  };
  function summary(note) {
    const bits = [conditionLabels[note.condition || 'comme-neuf'] || 'Comme neuf'];
    if (note.missing) bits.push('accessoires manquants');
    return bits.join(' · ');
  }
  function renderTabs(id, qty) {
    const tabs = document.getElementById('figureCopyTabs');
    if (!tabs) return;
    const copies = allCopyNotes(id);
    const count = Math.max(qty, copies.length);
    tabs.replaceChildren();
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'figure-copy-tab';
      btn.dataset.copyIndex = String(i);
      btn.textContent = `Exemplaire ${i + 1}`;
      btn.classList.toggle('active', i === currentCopy);
      btn.classList.toggle('has-note', hasCustomInfo(copies[i]));
      btn.classList.toggle('inactive-copy', i >= qty);
      btn.disabled = i >= qty;
      if (i >= qty) btn.title = 'Fiche conservée. Réaugmente la quantité pour la réactiver.';
      tabs.appendChild(btn);
    }
  }
  function renderEditor(autoSelectNew=true) {
    const nextId = getCurrentId();
    if (!nextId) return;
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
    if (qty > 0 && currentCopy >= qty) currentCopy = qty - 1;
    lastQty = qty;

    const box = document.getElementById('figureNotesBox');
    const locked = document.getElementById('figureNotesLocked');
    box?.classList.toggle('hidden', qty < 1);
    locked?.classList.toggle('hidden', qty > 0);
    if (qty < 1) return;

    renderTabs(currentId, qty);
    const note = noteFor(currentId, currentCopy);
    const condition = document.getElementById('figureCondition');
    const missing = document.getElementById('figureMissingAccessories');
    const text = document.getElementById('figureFreeNote');
    if (condition) condition.value = note.condition || 'comme-neuf';
    if (missing) missing.value = note.missing || '';
    if (text) text.value = note.text || '';
    const title = document.getElementById('figureCopyTitle');
    const sum = document.getElementById('figureCopySummary');
    if (title) title.textContent = `Exemplaire ${currentCopy + 1}`;
    if (sum) sum.textContent = summary(note);
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = '';
  }

  function getFormNote(previous={}) {
    const now = new Date().toISOString();
    return {
      condition: document.getElementById('figureCondition')?.value || 'comme-neuf',
      missing: document.getElementById('figureMissingAccessories')?.value?.trim() || '',
      text: document.getElementById('figureFreeNote')?.value?.trim() || '',
      createdAt: previous.createdAt || now,
      updatedAt: now
    };
  }
  function persistNote(id, copyIndex) {
    if (!id || copyIndex < 0 || copyIndex >= quantity(id)) return;
    const all = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
    const copies = Array.isArray(all[id]) ? [...all[id]] : [];
    while (copies.length <= copyIndex) copies.push(normalizeNote({}));
    copies[copyIndex] = getFormNote(copies[copyIndex]);
    all[id] = copies;
    localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(all));
    const saved = document.getElementById('figureNotesSaved');
    if (id === currentId && copyIndex === currentCopy && saved) saved.textContent = 'Enregistré ✓';
    const sum = document.getElementById('figureCopySummary');
    if (id === currentId && copyIndex === currentCopy && sum) sum.textContent = summary(copies[copyIndex]);
    window.dispatchEvent(new CustomEvent('brickscan-notes-change', {detail:{id, copy:copyIndex}}));
    decorateCards();
    scheduleAutoBackup();
  }
  function saveCurrentImmediately() {
    clearTimeout(saveTimer); saveTimer = null;
    persistNote(currentId, currentCopy);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = '…';
    const id = currentId, copy = currentCopy;
    saveTimer = setTimeout(() => { saveTimer = null; persistNote(id, copy); }, 350);
  }
  function flushPendingSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer); saveTimer = null;
    persistNote(currentId, currentCopy);
  }

  function decorateCards() {
    if (decorating) return;
    decorating = true;
    try {
      const notes = sanitizeCopyNotes(loadObject(COPY_NOTES_KEY));
      grid.querySelectorAll('.fig-card[data-id]').forEach(card => {
        const id = card.dataset.id;
        const qty = quantity(id);
        const custom = (notes[id] || []).slice(0, qty).filter(hasCustomInfo).length;
        let badge = card.querySelector('.v24-note-badge');
        if (custom > 0) {
          if (!badge) { badge = document.createElement('div'); badge.className = 'v24-note-badge'; card.appendChild(badge); }
          badge.textContent = custom > 1 ? `📝${custom}` : '📝';
          badge.title = `${custom} exemplaire${custom > 1 ? 's' : ''} avec informations particulières`;
        } else badge?.remove();
      });
    } finally { decorating = false; }
  }

  function buildBackupPayload(automatic=false) {
    return {
      format:'brickscan-mini-collection', formatVersion:4, appVersion:APP_VERSION,
      exportedAt:new Date().toISOString(), automatic,
      collection:{
        owned:loadArray('brickscan-owned'), counts:loadObject('brickscan-counts'),
        wishlist:loadArray('brickscan-wishlist'), copyNotes:sanitizeCopyNotes(loadObject(COPY_NOTES_KEY))
      }
    };
  }
  function scheduleAutoBackup() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { try { localStorage.setItem(AUTO_KEY, JSON.stringify(buildBackupPayload(true))); } catch (_) {} }, 400);
  }
  function exportBackup() {
    flushPendingSave();
    const payload = buildBackupPayload(false);
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    const d=new Date(); const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    a.href=url; a.download=`brickscan-collection-${date}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    const status=document.getElementById('backupStatus'); if(status) status.textContent='Export V2.6 créé avec les fiches de chaque exemplaire.';
  }
  function legacyNotesToCopies(notes) {
    const out={};
    if (!notes || typeof notes!=='object') return out;
    for (const [id,note] of Object.entries(notes)) if(validIds.has(id)) out[id]=[normalizeNote(note)];
    return out;
  }
  function applyParsedBackup(parsed,label='ce fichier') {
    const c=parsed?.collection && typeof parsed.collection==='object' ? parsed.collection : null;
    const legacyOwned=Array.isArray(parsed)?parsed:parsed?.owned;
    const owned=Array.isArray(c?.owned)?c.owned:(Array.isArray(legacyOwned)?legacyOwned:null);
    if(!owned) throw new Error('Format de sauvegarde non reconnu');
    const cleanOwned=[...new Set(owned.filter(id=>validIds.has(id)))];
    const counts=c?.counts && typeof c.counts==='object'?c.counts:{};
    const wishlist=Array.isArray(c?.wishlist)?c.wishlist.filter(id=>validIds.has(id)):[];
    const copyNotes=c?.copyNotes?sanitizeCopyNotes(c.copyNotes):legacyNotesToCopies(c?.notes||{});
    if(!confirm(`Restaurer la collection depuis ${label} ?\n\n${cleanOwned.length} figurine(s) et leurs fiches d’exemplaires seront restaurées.`)) return;
    localStorage.setItem('brickscan-owned',JSON.stringify(cleanOwned)); localStorage.setItem('brickscan-counts',JSON.stringify(counts)); localStorage.setItem('brickscan-wishlist',JSON.stringify(wishlist)); localStorage.setItem(COPY_NOTES_KEY,JSON.stringify(copyNotes)); localStorage.removeItem(LEGACY_NOTES_KEY); location.reload();
  }
  async function restoreFile(file){ if(!file)return; applyParsedBackup(JSON.parse(await file.text()),'ce fichier'); }
  function restoreAuto(){ const raw=localStorage.getItem(AUTO_KEY)||localStorage.getItem('brickscan-autobackup-v25')||localStorage.getItem('brickscan-autobackup-v24')||localStorage.getItem('brickscan-autobackup-v2'); if(raw) applyParsedBackup(JSON.parse(raw),'la sauvegarde automatique'); }
  function installBackupOverrides(){
    document.addEventListener('click',event=>{
      if(event.target.closest('#backupCollectionBtn')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();exportBackup();}
      else if(event.target.closest('#restoreCollectionBtn')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();document.getElementById('restoreCollectionInput')?.click();}
      else if(event.target.closest('#restoreAutoBackupBtn')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();restoreAuto();}
    },true);
    document.addEventListener('change',event=>{ if(event.target?.id!=='restoreCollectionInput')return; event.stopPropagation();event.stopImmediatePropagation(); restoreFile(event.target.files?.[0]).catch(e=>{const s=document.getElementById('backupStatus');if(s)s.textContent=`Restauration impossible · ${e.message}`;}).finally(()=>event.target.value=''); },true);
  }

  migrateLegacyNotes();
  injectUi();
  installBackupOverrides();

  // Important : on n'observe plus les enfants de la fiche. Cela évite le rerendu en boucle pendant la saisie.
  const sheetObserver = new MutationObserver(() => {
    if (!sheet.classList.contains('hidden')) requestAnimationFrame(() => renderEditor(false));
  });
  sheetObserver.observe(sheet,{attributes:true,attributeFilter:['class']});

  window.addEventListener('brickscan-collection-change',()=>{ if(!sheet.classList.contains('hidden')) renderEditor(true); decorateCards(); scheduleAutoBackup(); });
  window.addEventListener('storage',event=>{ if([COPY_NOTES_KEY,'brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)){ if(!sheet.classList.contains('hidden')) renderEditor(false); decorateCards(); } });
  window.addEventListener('beforeunload',flushPendingSave);

  decorateCards();
  scheduleAutoBackup();
})();
