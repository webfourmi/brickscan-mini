(() => {
  const APP_VERSION = '1.4.0';
  const $ = id => document.getElementById(id);
  const data = window.MINIFIG_DATA || [];
  const figIndex = new Map();
  const nameIndex = new Map();

  for (const series of data) {
    for (const fig of series.figures || []) {
      const full = {...fig, seriesId: series.id, seriesName: series.name, set: series.set};
      figIndex.set(fig.id, full);
      nameIndex.set(fig.name, full);
    }
  }

  const PHOTO_BASE = 'https://raw.githubusercontent.com/le0pard/lego-scanner/main/src/lib/assets/minifigures/';
  const folderMap = {
    'dnd': 'dungeons-and-dragons',
    'spiderverse': 'spiderman-spiderverse'
  };
  const fileOverrides = {
    'spiderverse-10': 'peter-b-parker-spider-man-may-mayday-parkern.jpg'
  };

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/&/g, ' ')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function photoUrl(fig) {
    if (!fig) return '';
    const folder = folderMap[fig.seriesId] || fig.seriesId;
    const filename = fileOverrides[fig.id] || `${slugify(fig.name_en || fig.name)}.jpg`;
    return `${PHOTO_BASE}${folder}/${filename}`;
  }

  function buildPhoto(fig, className, eager = false) {
    const img = document.createElement('img');
    img.className = className;
    img.src = photoUrl(fig);
    img.alt = fig?.name ? `Figurine ${fig.name}` : 'Figurine';
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    return img;
  }

  function decorateResult() {
    const card = $('resultCard');
    if (!card || card.classList.contains('hidden')) return;
    const name = $('resultName')?.textContent?.trim();
    const fig = nameIndex.get(name);
    if (!fig) return;

    let img = card.querySelector('.result-photo');
    if (!img) {
      img = buildPhoto(fig, 'result-photo', true);
      const avatar = $('resultAvatar');
      if (avatar) avatar.before(img);
      else card.prepend(img);
    } else if (img.dataset.figId !== fig.id) {
      img.src = photoUrl(fig);
      img.alt = `Figurine ${fig.name}`;
    }
    img.dataset.figId = fig.id;
    img.classList.remove('hidden');

    const avatar = $('resultAvatar');
    if (avatar) avatar.classList.add('photo-hidden');

    img.onerror = () => {
      img.classList.add('hidden');
      avatar?.classList.remove('photo-hidden');
    };
  }

  function decorateCollection() {
    const grid = $('collectionGrid');
    if (!grid) return;
    grid.querySelectorAll('.fig-card').forEach(card => {
      if (card.querySelector('.fig-photo')) return;
      const fig = figIndex.get(card.dataset.id);
      if (!fig) return;
      const img = buildPhoto(fig, 'fig-photo');
      img.onerror = () => img.remove();
      card.prepend(img);
    });
  }

  function decorateHistory() {
    const list = $('historyList');
    if (!list) return;
    list.querySelectorAll('.history-item').forEach(item => {
      if (item.querySelector('.history-photo')) return;
      const name = item.querySelector('.history-copy strong')?.textContent?.trim();
      const fig = nameIndex.get(name);
      if (!fig) return;
      const img = buildPhoto(fig, 'history-photo');
      img.onerror = () => img.remove();
      const oldAvatar = item.querySelector('.history-avatar');
      if (oldAvatar) oldAvatar.replaceWith(img);
      else item.prepend(img);
    });
  }

  let decorating = false;
  function decorateAll() {
    if (decorating) return;
    decorating = true;
    try {
      decorateResult();
      decorateCollection();
      decorateHistory();
    } finally {
      decorating = false;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorateAll));
  observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
  decorateAll();

  const updateBanner = $('updateBanner');
  const updateText = $('updateText');
  const updateBtn = $('updateBtn');
  const updateState = $('updateState');
  const checkUpdateBtn = $('checkUpdateBtn');
  const currentVersion = $('currentVersion');
  if (currentVersion) currentVersion.textContent = APP_VERSION;

  let latestVersion = APP_VERSION;
  let latestBuild = 140;

  function versionParts(v) {
    return String(v || '0').split('.').map(n => Number(n) || 0);
  }

  function isNewer(remote, current) {
    const a = versionParts(remote);
    const b = versionParts(current);
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av > bv) return true;
      if (av < bv) return false;
    }
    return false;
  }

  async function checkForUpdate(showStatus = false) {
    if (showStatus && updateState) updateState.textContent = 'Vérification…';
    try {
      const response = await fetch(`version.json?t=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const info = await response.json();
      latestVersion = info.version || APP_VERSION;
      latestBuild = info.build || 140;

      if (isNewer(latestVersion, APP_VERSION)) {
        if (updateText) updateText.textContent = `Version ${latestVersion} disponible${info.notes ? ' · ' + info.notes : ''}`;
        updateBanner?.classList.remove('hidden');
        if (updateState) updateState.textContent = `Nouvelle version ${latestVersion} disponible`;
        return true;
      }

      updateBanner?.classList.add('hidden');
      if (updateState) updateState.textContent = `BrickScan est à jour · v${APP_VERSION}`;
      return false;
    } catch (error) {
      console.warn('Vérification mise à jour impossible', error);
      if (showStatus && updateState) updateState.textContent = 'Vérification impossible hors ligne';
      return false;
    }
  }

  async function applyUpdate() {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = 'Mise à jour…';
    }
    if (updateState) updateState.textContent = 'Installation de la nouvelle version…';

    try {
      let reloadTriggered = false;
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloadTriggered) return;
            reloadTriggered = true;
            location.replace(`${location.pathname}?v=${latestBuild || Date.now()}`);
          }, {once:true});
        }
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('brickscan-mini-')).map(key => caches.delete(key)));
      }

      setTimeout(() => {
        if (!reloadTriggered) location.replace(`${location.pathname}?v=${latestBuild || Date.now()}`);
      }, 700);
    } catch (error) {
      console.error('Mise à jour impossible', error);
      if (updateState) updateState.textContent = 'Échec de la mise à jour. Réessaie avec Internet.';
      if (updateBtn) {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Mettre à jour';
      }
    }
  }

  updateBtn?.addEventListener('click', applyUpdate);
  checkUpdateBtn?.addEventListener('click', () => checkForUpdate(true));
  window.addEventListener('online', () => checkForUpdate(false));
  setTimeout(() => checkForUpdate(false), 1200);

  const infoCard = document.querySelector('#infoView .info-card');
  if (infoCard && !infoCard.querySelector('.image-credit')) {
    const credit = document.createElement('div');
    credit.className = 'image-credit';
    credit.innerHTML = 'Photos des figurines chargées depuis le projet open source <strong>L-Scan</strong>. Les marques et visuels LEGO restent la propriété de leurs ayants droit.';
    infoCard.appendChild(credit);
  }
})();
