(() => {
  const APP_VERSION = '2.5.1';
  const COPY_NOTES_KEY = 'brickscan-copy-notes';
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const figureBySheetKey = new Map();

  for (const series of data) {
    for (const fig of series.figures || []) {
      figureBySheetKey.set(`${series.name}::${fig.name}`, fig.id);
    }
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }

  function currentFigureId() {
    const name = document.getElementById('figureSheetName')?.textContent?.trim() || '';
    const series = document.getElementById('figureSheetSeries')?.textContent?.trim() || '';
    return figureBySheetKey.get(`${series}::${name}`) || null;
  }

  function currentCopyIndex() {
    const active = document.querySelector('#figureCopyTabs .figure-copy-tab.active');
    return Math.max(0, Number(active?.dataset?.copyIndex) || 0);
  }

  function saveConditionImmediately(select) {
    const id = currentFigureId();
    if (!id) return;

    const copyIndex = currentCopyIndex();
    const all = loadObject(COPY_NOTES_KEY);
    const copies = Array.isArray(all[id]) ? [...all[id]] : [];
    while (copies.length <= copyIndex) copies.push({});

    const previous = copies[copyIndex] && typeof copies[copyIndex] === 'object' ? copies[copyIndex] : {};
    const condition = String(select.value || '');
    const missing = document.getElementById('figureMissingAccessories')?.value?.trim() || String(previous.missing || '');
    const text = document.getElementById('figureFreeNote')?.value?.trim() || String(previous.text || '');
    const now = new Date().toISOString();

    if (condition || missing || text) {
      copies[copyIndex] = {
        ...previous,
        condition,
        missing,
        text,
        createdAt: previous.createdAt || previous.updatedAt || now,
        updatedAt: now
      };
      all[id] = copies;
    } else {
      copies[copyIndex] = {};
      if (copies.some(note => note && (note.condition || note.missing || note.text))) all[id] = copies;
      else delete all[id];
    }

    localStorage.setItem(COPY_NOTES_KEY, JSON.stringify(all));
    const saved = document.getElementById('figureNotesSaved');
    if (saved) saved.textContent = 'Enregistré ✓';
    window.dispatchEvent(new CustomEvent('brickscan-notes-change', {detail:{id, copy:copyIndex}}));
  }

  document.addEventListener('change', event => {
    if (event.target?.id !== 'figureCondition') return;
    saveConditionImmediately(event.target);
  }, true);

  if (!document.querySelector('script[data-brickscan-v24]')) {
    const script = document.createElement('script');
    script.src = 'v24.js?v=251';
    script.dataset.brickscanV24 = 'true';
    document.body.appendChild(script);
  }

  setTimeout(() => {
    const headerVersion = document.querySelector('.topbar p');
    if (headerVersion) headerVersion.textContent = 'Scanner de minifigurines · v2.5.1';
    const scanStatus = document.getElementById('scanStatus');
    if (scanStatus && /Prêt/.test(scanStatus.textContent || '')) scanStatus.textContent = 'Prêt · v2.5.1';
    const currentVersion = document.getElementById('currentVersion');
    if (currentVersion) currentVersion.textContent = APP_VERSION;
    document.title = 'BrickScan Mini 2.5.1';
  }, 0);
})();
