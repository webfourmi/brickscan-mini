(() => {
  const $ = id => document.getElementById(id);
  const backupBtn = $('backupCollectionBtn');
  const restoreBtn = $('restoreCollectionBtn');
  const restoreInput = $('restoreCollectionInput');
  const status = $('backupStatus');
  if (!backupBtn || !restoreBtn || !restoreInput) return;

  const validIds = new Set(
    (window.MINIFIG_DATA || []).flatMap(series => (series.figures || []).map(fig => fig.id))
  );

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

  function saveCollection() {
    const owned = sanitizeOwned(loadArray('brickscan-owned'));
    const wishlist = sanitizeWishlist(loadArray('brickscan-wishlist'));
    const counts = sanitizeCounts(loadObject('brickscan-counts'), owned);
    const payload = {
      format: 'brickscan-mini-collection',
      formatVersion: 2,
      appVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      collection: {
        owned,
        counts,
        wishlist
      },
      count: owned.length,
      owned
    };

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
    setStatus(`Sauvegarde créée · ${owned.length} figurines · ${copies} exemplaires · ${wishlist.length} souhaits.`);
  }

  async function restoreCollection(file) {
    if (!file) return;
    setStatus('Lecture de la sauvegarde…');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const oldList = Array.isArray(parsed) ? parsed : parsed?.owned;
      const collection = parsed?.collection && typeof parsed.collection === 'object' ? parsed.collection : null;
      const rawOwned = collection?.owned ?? oldList;
      if (!Array.isArray(rawOwned)) throw new Error('Format de sauvegarde non reconnu');

      const owned = sanitizeOwned(rawOwned);
      const wishlist = sanitizeWishlist(collection?.wishlist || []);
      const counts = sanitizeCounts(collection?.counts || {}, owned);
      const suppliedCount = Array.isArray(rawOwned) ? rawOwned.length : 0;
      const ignored = Math.max(0, suppliedCount - owned.length);

      if (!owned.length && suppliedCount) {
        throw new Error('Aucune figurine de cette sauvegarde ne correspond au catalogue actuel');
      }

      const copies = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);
      const message = `Restaurer ${owned.length} figurine${owned.length > 1 ? 's' : ''}, ${copies} exemplaire${copies > 1 ? 's' : ''} et ${wishlist.length} souhait${wishlist.length > 1 ? 's' : ''} ?\n\nLa collection, les quantités et la wishlist actuelles seront remplacées.${ignored ? `\n${ignored} ancien${ignored > 1 ? 's' : ''} identifiant${ignored > 1 ? 's' : ''} sera ignoré.` : ''}`;
      if (!confirm(message)) {
        setStatus('Restauration annulée.');
        return;
      }

      localStorage.setItem('brickscan-owned', JSON.stringify(owned));
      localStorage.setItem('brickscan-counts', JSON.stringify(counts));
      localStorage.setItem('brickscan-wishlist', JSON.stringify(wishlist));
      setStatus('Collection V2.0 restaurée. Rechargement…');
      setTimeout(() => location.reload(), 650);
    } catch (error) {
      console.error('BrickScan restore:', error);
      setStatus(`Restauration impossible · ${error?.message || 'fichier invalide'}`, true);
    } finally {
      restoreInput.value = '';
    }
  }

  backupBtn.addEventListener('click', saveCollection);
  restoreBtn.addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', event => restoreCollection(event.target.files?.[0]));
})();
