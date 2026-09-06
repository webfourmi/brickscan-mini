(() => {
  const APP_VERSION = '2.0.2';
  const AUTO_KEY = 'brickscan-autobackup-v2';
  const AUTO_PREV_KEY = 'brickscan-autobackup-prev-v2';
  const $ = id => document.getElementById(id);
  const backupBtn = $('backupCollectionBtn');
  const restoreBtn = $('restoreCollectionBtn');
  const restoreInput = $('restoreCollectionInput');
  const status = $('backupStatus');
  if (!backupBtn || !restoreBtn || !restoreInput) return;

  const validIds = new Set(
    (window.MINIFIG_DATA || []).flatMap(series => (series.figures || []).map(fig => fig.id))
  );
  let autoState = null;
  let autoTimer = null;
  let autoPaused = false;

  function injectCompactUi() {
    const view = document.getElementById('collectionView');
    const head = view?.querySelector('.section-head');
    const oldCard = view?.querySelector('.backup-card');
    const clearBtn = document.getElementById('clearCollection');
    if (!head || !oldCard || !clearBtn) return;

    let actions = head.querySelector('.collection-head-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'collection-head-actions';
      head.appendChild(actions);
    }

    const details = document.createElement('details');
    details.id = 'backupMenu';
    details.className = 'backup-compact';

    const summary = document.createElement('summary');
    summary.className = 'backup-icon-btn';
    summary.title = 'Sauvegarde';
    summary.setAttribute('aria-label', 'Sauvegarde');
    summary.textContent = '💾';

    const popover = document.createElement('div');
    popover.className = 'backup-popover';
    const title = document.createElement('strong');
    title.textContent = 'Sauvegarde';
    autoState = document.createElement('small');
    autoState.id = 'backupAutoState';
    autoState.className = 'backup-auto-state';
    autoState.textContent = 'Sauvegarde automatique active';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'backup-popover-actions';
    backupBtn.textContent = '⬇️ Exporter';
    restoreBtn.textContent = '⬆️ Restaurer';
    buttonRow.append(backupBtn, restoreBtn);

    const restoreAutoBtn = document.createElement('button');
    restoreAutoBtn.id = 'restoreAutoBackupBtn';
    restoreAutoBtn.type = 'button';
    restoreAutoBtn.className = 'backup-auto-restore';
    restoreAutoBtn.textContent = '↶ Récupérer la sauvegarde auto';
    restoreAutoBtn.addEventListener('click', restoreAutomaticBackup);

    popover.append(title, autoState, buttonRow, restoreAutoBtn, restoreInput, status);
    details.append(summary, popover);
    actions.append(details, clearBtn);
    oldCard.remove();

    if (!document.getElementById('backupCompactStyles')) {
      const style = document.createElement('style');
      style.id = 'backupCompactStyles';
      style.textContent = `
        .collection-head-actions{display:flex;align-items:center;gap:6px;position:relative}
        .backup-compact{position:relative}
        .backup-compact>summary{list-style:none}.backup-compact>summary::-webkit-details-marker{display:none}
        .backup-icon-btn{width:38px;height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:12px;display:grid;place-items:center;cursor:pointer;font-size:17px;box-shadow:0 2px 8px rgba(17,24,39,.05)}
        .backup-compact[open] .backup-icon-btn{background:#f3f4f6}
        .backup-popover{position:absolute;right:0;top:46px;z-index:35;width:min(300px,calc(100vw - 32px));display:grid;gap:9px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:13px;box-shadow:0 16px 38px rgba(17,24,39,.18)}
        .backup-popover>strong{font-size:14px}.backup-auto-state{font-size:11px;line-height:1.35;color:#6b7280}
        .backup-popover-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.backup-popover-actions .btn{width:100%;padding-left:9px;padding-right:9px}
        .backup-auto-restore{border:0;background:transparent;color:#4b5563;text-align:left;padding:5px 2px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
        .backup-popover .backup-status{font-size:11px;line-height:1.35;min-height:0}.backup-popover .backup-status:empty{display:none}
        @media(max-width:420px){.collection-head-actions{gap:3px}.backup-icon-btn{width:36px;height:36px}.backup-popover{position:fixed;right:16px;top:92px}}
      `;
      document.head.appendChild(style);
    }
  }

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.dataset.error = isError ? 'true' : 'false';
  }

  function today() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function loadArray(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  }
  function loadObject(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (_) { return {}; }
  }

  function sanitizeOwned(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && validIds.has(id)))];
  }
  function sanitizeWishlist(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && validIds.has(id)))];
  }
  function sanitizeCounts(obj, owned) {
    const out = {};
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [id, value] of Object.entries(obj)) {
        if (!validIds.has(id)) continue;
        const n = Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
        if (n > 0) out[id] = n;
      }
    }
    for (const id of owned) if (!out[id]) out[id] = 1;
    return out;
  }

  function buildPayload(isAuto = false) {
    const owned = sanitizeOwned(loadArray('brickscan-owned'));
    const wishlist = sanitizeWishlist(loadArray('brickscan-wishlist'));
    const counts = sanitizeCounts(loadObject('brickscan-counts'), owned);
    return {
      format: 'brickscan-mini-collection',
      formatVersion: 2,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      automatic: Boolean(isAuto),
      collection: {owned, counts, wishlist},
      count: owned.length,
      owned
    };
  }

  function collectionSignature(payload) {
    return JSON.stringify(payload?.collection || {});
  }

  function updateAutoState(payload) {
    if (!autoState) return;
    if (!payload) {
      autoState.textContent = 'Sauvegarde automatique prête';
      return;
    }
    const d = new Date(payload.exportedAt || Date.now());
    const time = d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    const owned = payload.collection?.owned?.length || 0;
    const wishes = payload.collection?.wishlist?.length || 0;
    autoState.textContent = `Auto à jour · ${time} · ${owned} figurine${owned !== 1 ? 's' : ''} · ${wishes} souhait${wishes !== 1 ? 's' : ''}`;
  }

  function saveAutomaticBackup() {
    if (autoPaused) return;
    try {
      const payload = buildPayload(true);
      const previousRaw = localStorage.getItem(AUTO_KEY);
      if (previousRaw) {
        try {
          const previous = JSON.parse(previousRaw);
          if (collectionSignature(previous) === collectionSignature(payload)) {
            updateAutoState(previous);
            return;
          }
          localStorage.setItem(AUTO_PREV_KEY, previousRaw);
        } catch (_) {}
      }
      localStorage.setItem(AUTO_KEY, JSON.stringify(payload));
      updateAutoState(payload);
    } catch (error) {
      console.warn('BrickScan auto backup:', error);
      if (autoState) autoState.textContent = 'Sauvegarde automatique momentanément indisponible';
    }
  }

  function scheduleAutoBackup() {
    if (autoPaused) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(saveAutomaticBackup, 350);
  }

  function saveCollection() {
    const payload = buildPayload(false);
    const {owned, counts, wishlist} = payload.collection;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brickscan-collection-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const copies = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);
    setStatus(`Export créé · ${owned.length} figurines · ${copies} exemplaires · ${wishlist.length} souhaits.`);
  }

  function parseBackup(parsed) {
    const oldList = Array.isArray(parsed) ? parsed : parsed?.owned;
    const collection = parsed?.collection && typeof parsed.collection === 'object' ? parsed.collection : null;
    const rawOwned = collection?.owned ?? oldList;
    if (!Array.isArray(rawOwned)) throw new Error('Format de sauvegarde non reconnu');
    const owned = sanitizeOwned(rawOwned);
    const wishlist = sanitizeWishlist(collection?.wishlist || []);
    const counts = sanitizeCounts(collection?.counts || {}, owned);
    const suppliedCount = rawOwned.length;
    const ignored = Math.max(0, suppliedCount - owned.length);
    if (!owned.length && suppliedCount) throw new Error('Aucune figurine de cette sauvegarde ne correspond au catalogue actuel');
    return {owned, wishlist, counts, ignored};
  }

  function applyBackup(parsed, sourceLabel = 'sauvegarde') {
    const {owned, wishlist, counts, ignored} = parseBackup(parsed);
    const copies = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);
    const message = `Restaurer ${owned.length} figurine${owned.length > 1 ? 's' : ''}, ${copies} exemplaire${copies > 1 ? 's' : ''} et ${wishlist.length} souhait${wishlist.length > 1 ? 's' : ''} depuis ${sourceLabel} ?\n\nLa collection, les quantités et la wishlist actuelles seront remplacées.${ignored ? `\n${ignored} ancien${ignored > 1 ? 's' : ''} identifiant${ignored > 1 ? 's' : ''} sera ignoré.` : ''}`;
    if (!confirm(message)) {
      setStatus('Restauration annulée.');
      return false;
    }
    autoPaused = true;
    localStorage.setItem('brickscan-owned', JSON.stringify(owned));
    localStorage.setItem('brickscan-counts', JSON.stringify(counts));
    localStorage.setItem('brickscan-wishlist', JSON.stringify(wishlist));
    autoPaused = false;
    saveAutomaticBackup();
    setStatus('Collection restaurée. Rechargement…');
    setTimeout(() => location.reload(), 650);
    return true;
  }

  async function restoreCollection(file) {
    if (!file) return;
    setStatus('Lecture de la sauvegarde…');
    try {
      const text = await file.text();
      applyBackup(JSON.parse(text), 'ce fichier');
    } catch (error) {
      console.error('BrickScan restore:', error);
      setStatus(`Restauration impossible · ${error?.message || 'fichier invalide'}`, true);
    } finally {
      restoreInput.value = '';
    }
  }

  function restoreAutomaticBackup() {
    try {
      const raw = localStorage.getItem(AUTO_KEY) || localStorage.getItem(AUTO_PREV_KEY);
      if (!raw) {
        setStatus('Aucune sauvegarde automatique disponible.', true);
        return;
      }
      applyBackup(JSON.parse(raw), 'la sauvegarde automatique');
    } catch (error) {
      console.error('BrickScan auto restore:', error);
      setStatus('Sauvegarde automatique illisible.', true);
    }
  }

  injectCompactUi();
  backupBtn.addEventListener('click', saveCollection);
  restoreBtn.addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', event => restoreCollection(event.target.files?.[0]));
  window.addEventListener('brickscan-collection-change', scheduleAutoBackup);
  window.addEventListener('storage', event => {
    if (['brickscan-owned','brickscan-counts','brickscan-wishlist'].includes(event.key)) scheduleAutoBackup();
  });

  try {
    const existing = JSON.parse(localStorage.getItem(AUTO_KEY) || 'null');
    updateAutoState(existing);
  } catch (_) {
    updateAutoState(null);
  }
  setTimeout(saveAutomaticBackup, 450);
})();
