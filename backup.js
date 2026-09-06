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

  function currentOwned() {
    try {
      const raw = JSON.parse(localStorage.getItem('brickscan-owned') || '[]');
      return Array.isArray(raw) ? raw.filter(id => typeof id === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function saveCollection() {
    const owned = [...new Set(currentOwned())].filter(id => validIds.has(id));
    const payload = {
      format: 'brickscan-mini-collection',
      formatVersion: 1,
      appVersion: '1.9.0',
      exportedAt: new Date().toISOString(),
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
    setStatus(`Sauvegarde créée · ${owned.length} figurine${owned.length > 1 ? 's' : ''}.`);
  }

  async function restoreCollection(file) {
    if (!file) return;
    setStatus('Lecture de la sauvegarde…');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.owned;

      if (!Array.isArray(list)) throw new Error('Format de sauvegarde non reconnu');

      const unique = [...new Set(list.filter(id => typeof id === 'string'))];
      const accepted = unique.filter(id => validIds.has(id));
      const ignored = unique.length - accepted.length;

      if (!accepted.length && unique.length) {
        throw new Error('Aucune figurine de cette sauvegarde ne correspond au catalogue actuel');
      }

      const message = `Restaurer ${accepted.length} figurine${accepted.length > 1 ? 's' : ''} ?\n\nLa collection actuellement cochée sera remplacée.${ignored ? `\n${ignored} ancien${ignored > 1 ? 's' : ''} identifiant${ignored > 1 ? 's' : ''} sera ignoré.` : ''}`;
      if (!confirm(message)) {
        setStatus('Restauration annulée.');
        return;
      }

      localStorage.setItem('brickscan-owned', JSON.stringify(accepted));
      setStatus(`Collection restaurée · ${accepted.length} figurine${accepted.length > 1 ? 's' : ''}. Rechargement…`);
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
