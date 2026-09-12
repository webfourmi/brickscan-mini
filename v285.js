(() => {
  const OWNED_KEY = 'brickscan-owned';
  const WISHLIST_KEY = 'brickscan-wishlist';
  let reconciling = false;

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function reconcileWishlist() {
    if (reconciling) return false;
    const owned = new Set(loadArray(OWNED_KEY));
    const wishlist = loadArray(WISHLIST_KEY);
    const cleaned = wishlist.filter(id => !owned.has(id));
    if (cleaned.length === wishlist.length) return false;

    reconciling = true;
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(cleaned));
      window.dispatchEvent(new CustomEvent('brickscan-wishlist-reconciled', {
        detail: {removed: wishlist.length - cleaned.length}
      }));
    } finally {
      reconciling = false;
    }
    return true;
  }

  // Nettoie les anciennes données où une figurine pouvait être à la fois
  // possédée et présente dans la wishlist.
  reconcileWishlist();

  // v20 déclenche cet événement après un ajout, une suppression ou un changement de wishlist.
  // Le nettoyage a lieu dans le même cycle, avant le prochain rendu requestAnimationFrame.
  window.addEventListener('brickscan-collection-change', reconcileWishlist);

  // Synchronisation entre plusieurs onglets/appareils partageant le même stockage navigateur.
  window.addEventListener('storage', event => {
    if (event.key === OWNED_KEY || event.key === WISHLIST_KEY) reconcileWishlist();
  });
})();