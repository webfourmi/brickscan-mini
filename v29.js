(() => {
  const VERSION = '2.9.1';
  const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';
  const MODEL_ID = 'Xenova/clip-vit-base-patch32';
  const data = Array.isArray(window.MINIFIG_DATA) ? window.MINIFIG_DATA : [];
  const scannerCard = document.querySelector('#scanView .scanner-card');
  const actions = scannerCard?.querySelector('.actions-row');
  if (!scannerCard || !actions || !data.length) return;

  let classifier = null;
  let classifierPromise = null;
  let visualStream = null;
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
      .visual-live-wrap{position:relative;overflow:hidden;border-radius:16px;background:#111827;aspect-ratio:3/4;max-height:62vh}.visual-live-video{width:100%;height:100%;object-fit:cover;display:block}.visual-live-guide{position:absolute;inset:10% 18%;border:2px solid rgba(255,255,255,.9);border-radius:24px;box-shadow:0 0 0 999px rgba(0,0,0,.18);pointer-events:none}.visual-live-guide:after{content:'Place la figurine entière ici';position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);white-space:nowrap;color:#fff;background:rgba(17,24,39,.78);font-size:11px;font-weight:700;padding:5px 8px;border-radius:999px}
      .visual-status{font-size:12px;line-height:1.45;color:#4b5563}.visual-status strong{color:#111827}.visual-progress{height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden}.visual-progress span{display:block;height:100%;width:0;background:#4f46e5;transition:width .2s ease}
      .visual-winner{border:1px solid #c7d2fe;background:#eef2ff;border-radius:15px;padding:13px}.visual-winner small{display:block;color:#6366f1;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.visual-winner strong{display:block;font-size:18px;margin-top:3px;color:#312e81}.visual-winner p{margin:5px 0 0;font-size:12px;color:#4b5563}
      .visual-alternatives{display:grid;gap:7px}.visual-alt{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:9px;align-items:center;font-size:12px}.visual-alt-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.visual-alt-bar{height:7px;background:#e5e7eb;border-radius:999px;overflow:hidden}.visual-alt-bar span{display:block;height:100%;background:#818cf8}
      .visual-note{font-size:10px;line-height:1.45;color:#6b7280;background:#f9fafb;border-radius:12px;padding:10px}.visual-actions{display:flex;gap:8px;flex-wrap:wrap}.visual-actions .btn{flex:1 1 145px}.visual-analyze-btn{font-weight:800}
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
    actions.append(button);

    const card = document.createElement('section');
    card.id = 'visualScanCard';
    card.className = 'visual-scan-card hidden';
    card.innerHTML = `
      <div class="visual-head"><div><div class="eyebrow">RECONNAISSANCE VISUELLE</div><h3>De quelle série vient cette figurine ?</h3></div><span class="visual-beta">BÊTA</span></div>
      <div class="visual-live-wrap"><video id="visualVideo" class="visual-live-video" autoplay playsinline muted></video><div class="visual-live-guide"></div></div>
      <div id="visualStatus" class="visual-status">Cadre la figurine entière, de face, sur un fond assez uni.</div>
      <div id="visualProgress" class="visual-progress hidden"><span></span></div>
      <div id="visualResults" class="hidden"></div>
      <div class="visual-note">L’analyse se fait à partir du flux caméra affiché ici. Aucune photo n’est enregistrée par BrickScan. Au premier essai, le modèle visuel doit être téléchargé.</div>
      <div class="visual-actions"><button id="visualAnalyzeBtn" type="button" class="btn primary visual-analyze-btn">✨ Identifier cette figurine</button><button id="visualCloseBtn" type="button" class="btn ghost">Fermer</button></div>`;
    scannerCard.after(card);

    button.addEventListener('click', openVisualScanner);
    document.getElementById('visualAnalyzeBtn')?.addEventListener('click', analyzeCurrentFrame);
    document.getElementById('visualCloseBtn')?.addEventListener('click', () => stopVisualScanner(true));

    const normalStart = document.getElementById('startBtn');
    normalStart?.addEventListener('click', () => stopVisualScanner(false), true);
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.view !== 'scanView') stopVisualScanner(false);
    }));
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

  async function openVisualScanner() {
    if (busy) return;
    const card = document.getElementById('visualScanCard');
    const video = document.getElementById('visualVideo');
    const results = document.getElementById('visualResults');
    if (!card || !video) return;

    const normalStop = document.getElementById('stopBtn');
    if (normalStop && !normalStop.classList.contains('hidden')) {
      normalStop.click();
      await new Promise(resolve => setTimeout(resolve, 180));
    }

    results?.classList.add('hidden');
    card.classList.remove('hidden');
    card.scrollIntoView({behavior:'smooth', block:'start'});

    if (visualStream?.getVideoTracks?.().some(track => track.readyState === 'live')) {
      if (video.srcObject !== visualStream) video.srcObject = visualStream;
      try { await video.play(); } catch (_) {}
      setStatus('<strong>Caméra prête.</strong> Cadre la figurine puis touche « Identifier cette figurine ».');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('<strong>Caméra indisponible sur ce navigateur.</strong>');
      return;
    }

    setStatus('<strong>Ouverture de la caméra…</strong>');
    try {
      visualStream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1920}}
      });
      video.srcObject = visualStream;
      video.muted = true;
      video.setAttribute('playsinline','');
      await video.play();
      setStatus('<strong>Caméra prête.</strong> Cadre la figurine entière puis lance l’identification.');
    } catch (error) {
      console.error('BrickScan V2.9.1 caméra visuelle', error);
      visualStream = null;
      setStatus(error?.name === 'NotAllowedError' ? '<strong>Accès caméra refusé.</strong> Autorise la caméra dans Chrome.' : '<strong>Impossible d’ouvrir la caméra.</strong>');
    }
  }

  function stopVisualScanner(hideCard=true) {
    if (visualStream) {
      visualStream.getTracks().forEach(track => track.stop());
      visualStream = null;
    }
    const video = document.getElementById('visualVideo');
    if (video) {
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
    }
    if (hideCard) document.getElementById('visualScanCard')?.classList.add('hidden');
  }

  function captureCurrentFrame() {
    const video = document.getElementById('visualVideo');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    const sourceW = video.videoWidth;
    const sourceH = video.videoHeight;
    const maxSide = 768;
    const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(224, Math.round(sourceW * scale));
    canvas.height = Math.max(224, Math.round(sourceH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
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

  async function identifyFigureInsideSeries(model, image, series) {
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
      const output = await model(image, labels, {hypothesis_template:'This is a photo of {}'});
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

  async function analyzeCurrentFrame() {
    if (busy) return;
    const frame = captureCurrentFrame();
    if (!frame) {
      setStatus('<strong>Image caméra pas encore prête.</strong> Attends une seconde puis réessaie.');
      return;
    }

    busy = true;
    const analyzeBtn = document.getElementById('visualAnalyzeBtn');
    const results = document.getElementById('visualResults');
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyse…';
    }
    results?.classList.add('hidden');
    if (results) results.innerHTML = '';
    setStatus('<strong>Préparation de la reconnaissance…</strong>');
    setProgress(2, true);

    try {
      const model = await loadClassifier();
      setStatus(`<strong>Analyse de la figurine…</strong><br>Comparaison avec ${data.length} séries du catalogue.`);
      setProgress(94, true);
      const output = await model(frame, promptIndex.labels, {hypothesis_template:'This is a photo of {}'});
      const ranked = aggregateSeries(output);
      if (!ranked.length) throw new Error('Aucune série candidate');
      const figGuess = await identifyFigureInsideSeries(model, frame, ranked[0].series);
      setProgress(100, true);
      renderResults(ranked, figGuess);
      setStatus(`<strong>Analyse terminée.</strong> ${confidenceText(ranked[0], ranked[1])}. Tu peux recadrer et relancer immédiatement.`);
      setTimeout(() => setProgress(0, false), 700);
    } catch (error) {
      console.error('BrickScan V2.9.1 visual scan', error);
      setProgress(0, false);
      setStatus('<strong>Reconnaissance visuelle indisponible.</strong><br>Vérifie la connexion Internet pour le premier chargement du modèle, puis réessaie.');
    } finally {
      busy = false;
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '✨ Identifier cette figurine';
      }
    }
  }

  injectUi();
  window.addEventListener('pagehide', () => stopVisualScanner(false));
})();