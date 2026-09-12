(() => {
  const VERSION = '2.9.0';
  const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';
  const MODEL_ID = 'Xenova/clip-vit-base-patch32';
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const scannerCard = document.querySelector('#scanView .scanner-card');
  const actions = scannerCard?.querySelector('.actions-row');
  if (!scannerCard || !actions || !data.length) return;

  let classifier = null;
  let classifierPromise = null;
  let previewUrl = '';
  let busy = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function buildPromptIndex() {
    const labels = [];
    const lookup = new Map();
    for (const series of data) {
      const figures = Array.isArray(series.figures) ? series.figures : [];
      if (!figures.length) continue;
      const names = figures.map(fig => String(fig.name_en || fig.name || '').trim()).filter(Boolean);
      for (let i = 0; i < names.length; i += 6) {
        const chunk = names.slice(i, i + 6);
        if (!chunk.length) continue;
        let label = `LEGO collectible minifigures featuring ${chunk.join(', ')}`;
        if (lookup.has(label)) label += ` from ${series.name}`;
        labels.push(label);
        lookup.set(label, series);
      }
    }
    return {labels, lookup};
  }

  const promptIndex = buildPromptIndex();

  function injectStyles() {
    if (document.getElementById('v29Styles')) return;
    const style = document.createElement('style');
    style.id = 'v29Styles';
    style.textContent = `
      .visual-scan-btn{border-color:#c7d2fe!important;background:#eef2ff!important;color:#3730a3!important}
      .visual-scan-card{margin-top:14px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:14px;display:grid;gap:12px}
      .visual-scan-card.hidden{display:none}.visual-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.visual-head h3{margin:2px 0 0;font-size:16px}.visual-beta{font-size:10px;font-weight:800;background:#ede9fe;color:#6d28d9;border-radius:999px;padding:5px 8px;white-space:nowrap}
      .visual-preview{width:100%;max-height:310px;object-fit:contain;border-radius:14px;background:#f3f4f6}.visual-status{font-size:12px;line-height:1.45;color:#4b5563}.visual-status strong{color:#111827}.visual-progress{height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden}.visual-progress span{display:block;height:100%;width:0;background:#4f46e5;transition:width .2s ease}
      .visual-winner{border:1px solid #c7d2fe;background:#eef2ff;border-radius:15px;padding:13px}.visual-winner small{display:block;color:#6366f1;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.visual-winner strong{display:block;font-size:18px;margin-top:3px;color:#312e81}.visual-winner p{margin:5px 0 0;font-size:12px;color:#4b5563}
      .visual-alternatives{display:grid;gap:7px}.visual-alt{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:9px;align-items:center;font-size:12px}.visual-alt-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.visual-alt-bar{height:7px;background:#e5e7eb;border-radius:999px;overflow:hidden}.visual-alt-bar span{display:block;height:100%;background:#818cf8}
      .visual-note{font-size:10px;line-height:1.45;color:#6b7280;background:#f9fafb;border-radius:12px;padding:10px}.visual-actions{display:flex;gap:8px;flex-wrap:wrap}.visual-actions .btn{flex:1 1 145px}
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    if (document.getElementById('visualScanBtn')) return;
    injectStyles();

    const button = document.createElement('button');
    button.id = 'visualScanBtn';
    button.type = 'button';
    button.className = 'btn secondary visual-scan-btn';
    button.textContent = '🧍 Scanner une figurine';

    const input = document.createElement('input');
    input.id = 'visualFigureInput';
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.hidden = true;

    actions.append(button, input);

    const card = document.createElement('section');
    card.id = 'visualScanCard';
    card.className = 'visual-scan-card hidden';
    card.innerHTML = `
      <div class="visual-head"><div><div class="eyebrow">RECONNAISSANCE VISUELLE</div><h3>De quelle série vient cette figurine ?</h3></div><span class="visual-beta">BÊTA</span></div>
      <img id="visualPreview" class="visual-preview hidden" alt="Photo de la figurine à identifier">
      <div id="visualStatus" class="visual-status">Prends la figurine entière, de face, sur un fond assez uni.</div>
      <div id="visualProgress" class="visual-progress hidden"><span></span></div>
      <div id="visualResults" class="hidden"></div>
      <div class="visual-note">La photo est analysée sur cet appareil. Au premier essai, BrickScan télécharge le modèle visuel. Le résultat est une estimation : pièces mélangées, accessoires manquants ou mauvais éclairage peuvent tromper la reconnaissance.</div>
      <div class="visual-actions"><button id="visualRetryBtn" type="button" class="btn secondary">📷 Reprendre une photo</button><button id="visualCloseBtn" type="button" class="btn ghost">Fermer</button></div>`;
    scannerCard.after(card);

    button.addEventListener('click', () => openCamera(input));
    document.getElementById('visualRetryBtn')?.addEventListener('click', () => openCamera(input));
    document.getElementById('visualCloseBtn')?.addEventListener('click', () => card.classList.add('hidden'));
    input.addEventListener('change', event => {
      const file = event.target.files?.[0];
      input.value = '';
      if (file) analyzeFigure(file);
    });
  }

  function openCamera(input) {
    if (busy) return;
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn && !stopBtn.classList.contains('hidden')) stopBtn.click();
    input.click();
  }

  function setStatus(html) {
    const el = document.getElementById('visualStatus');
    if (el) el.innerHTML = html;
  }

  function setProgress(value, visible=true) {
    const wrap = document.getElementById('visualProgress');
    const bar = wrap?.querySelector('span');
    if (!wrap || !bar) return;
    wrap.classList.toggle('hidden', !visible);
    bar.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  }

  async function loadClassifier() {
    if (classifier) return classifier;
    if (classifierPromise) return classifierPromise;

    classifierPromise = (async () => {
      setStatus('<strong>Chargement du moteur visuel…</strong><br>Le premier lancement peut prendre un moment.');
      setProgress(3, true);
      const module = await import(TRANSFORMERS_URL);
      const { pipeline, env } = module;
      if (env) env.allowLocalModels = false;
      classifier = await pipeline('zero-shot-image-classification', MODEL_ID, {
        progress_callback: info => {
          const p = Number(info?.progress);
          if (Number.isFinite(p)) {
            setProgress(Math.max(5, Math.min(92, p)), true);
            setStatus(`<strong>Téléchargement du modèle visuel… ${Math.round(p)} %</strong><br>Il sera réutilisé aux prochains scans.`);
          }
        }
      });
      setProgress(100, true);
      return classifier;
    })().catch(error => {
      classifierPromise = null;
      classifier = null;
      throw error;
    });

    return classifierPromise;
  }

  function aggregateSeries(results) {
    const bySeries = new Map();
    for (const item of Array.isArray(results) ? results : []) {
      const series = promptIndex.lookup.get(item.label);
      if (!series) continue;
      const current = bySeries.get(series.id);
      const score = Number(item.score) || 0;
      if (!current || score > current.score) bySeries.set(series.id, {series, score});
    }
    return [...bySeries.values()].sort((a,b) => b.score - a.score);
  }

  function confidenceText(top, second) {
    const ratio = top?.score / Math.max(second?.score || 0.000001, 0.000001);
    if (!top || top.score < 0.02 || ratio < 1.12) return 'Confiance faible';
    if (ratio >= 1.65) return 'Confiance forte';
    return 'Confiance moyenne';
  }

  async function identifyFigureInsideSeries(model, file, series) {
    const figures = Array.isArray(series?.figures) ? series.figures : [];
    if (!figures.length) return null;
    const labelMap = new Map();
    const labels = figures.map((fig, index) => {
      let label = `LEGO minifigure ${fig.name_en || fig.name}`;
      if (labelMap.has(label)) label += ` character ${index + 1}`;
      labelMap.set(label, fig);
      return label;
    });
    try {
      const output = await model(file, labels, {hypothesis_template:'This is a photo of {}'});
      const best = Array.isArray(output) ? output[0] : null;
      const fig = best ? labelMap.get(best.label) : null;
      return fig ? {fig, score:Number(best.score)||0} : null;
    } catch (_) {
      return null;
    }
  }

  function renderResults(ranked, figGuess) {
    const box = document.getElementById('visualResults');
    if (!box || !ranked.length) return;
    const top = ranked[0];
    const second = ranked[1];
    const shown = ranked.slice(0,3);
    const max = Math.max(top.score, 0.000001);
    const confidence = confidenceText(top, second);
    box.innerHTML = `
      <div class="visual-winner">
        <small>Série la plus probable · ${esc(confidence)}</small>
        <strong>${esc(top.series.name)}</strong>
        <p>${top.series.set ? `Set ${esc(top.series.set)}` : ''}${top.series.year ? ` · ${esc(top.series.year)}` : ''}${figGuess ? ` · Figurine probable : <b>${esc(figGuess.fig.name)}</b>` : ''}</p>
      </div>
      <div class="visual-alternatives">
        ${shown.map((item,index) => `<div class="visual-alt"><span class="visual-alt-name">${index===0?'✓ ':''}${esc(item.series.name)}</span><span class="visual-alt-bar"><span style="width:${Math.max(8, Math.round(item.score/max*100))}%"></span></span></div>`).join('')}
      </div>`;
    box.classList.remove('hidden');
  }

  async function analyzeFigure(file) {
    if (busy) return;
    busy = true;
    const card = document.getElementById('visualScanCard');
    const preview = document.getElementById('visualPreview');
    const results = document.getElementById('visualResults');
    card?.classList.remove('hidden');
    results?.classList.add('hidden');
    if (results) results.innerHTML = '';

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    if (preview) {
      preview.src = previewUrl;
      preview.classList.remove('hidden');
    }

    card?.scrollIntoView({behavior:'smooth', block:'start'});
    setStatus('<strong>Préparation de la reconnaissance…</strong>');
    setProgress(2, true);

    try {
      const model = await loadClassifier();
      setStatus(`<strong>Analyse de la figurine…</strong><br>Comparaison avec ${data.length} séries du catalogue.`);
      setProgress(94, true);
      const output = await model(file, promptIndex.labels, {hypothesis_template:'This is a photo of {}'});
      const ranked = aggregateSeries(output);
      if (!ranked.length) throw new Error('Aucune série candidate');
      const figGuess = await identifyFigureInsideSeries(model, file, ranked[0].series);
      setProgress(100, true);
      renderResults(ranked, figGuess);
      setStatus(`<strong>Analyse terminée.</strong> ${confidenceText(ranked[0], ranked[1])}.`);
      setTimeout(() => setProgress(0, false), 700);
    } catch (error) {
      console.error('BrickScan V2.9 visual scan', error);
      setProgress(0, false);
      setStatus('<strong>Reconnaissance visuelle indisponible.</strong><br>Vérifie la connexion Internet pour le premier chargement du modèle, puis réessaie avec une photo nette de la figurine entière.');
    } finally {
      busy = false;
    }
  }

  injectUi();
  window.addEventListener('pagehide', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
})();