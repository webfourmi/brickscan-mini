(() => {
  const VERSION = '2.9.2';
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

  const VISUAL_HINTS = {
    'series-29-1': 'soccer goalkeeper with sports gloves and a football',
    'series-29-2': 'marine biologist scientist with ocean research equipment',
    'series-29-3': 'musician holding a large brass tuba',
    'series-29-4': 'fantasy unicorn elf with unicorn features',
    'series-29-5': 'fantasy monster hunter adventurer with hunting gear',
    'series-29-6': 'robotic Tyrannosaurus rex dinosaur character',
    'series-29-7': 'chocolatier candy maker with chocolate accessories',
    'series-29-8': 'person wearing a giant bubble tea cup costume',
    'series-29-9': 'Bionicle fan cosplayer in mechanical fantasy armor',
    'series-29-10': 'mysterious Japanese ronin samurai warrior',
    'series-29-11': 'cute magical girl witch wearing a purple witch hat, light blue hair, pink bow, blue violet outfit, cat companion and cat-pattern socks',
    'series-29-12': 'trash garbage monster made from rubbish and waste'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[c]));
  }

  function numericSeriesNumber(series) {
    const match = String(series?.id || '').match(/^series-(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function isModernSeries(series) {
    const n = numericSeriesNumber(series);
    return (Number.isFinite(n) && n >= 25) || ['dnd','spiderverse','shrek'].includes(series?.id);
  }

  function visualDescription(series, fig) {
    if (VISUAL_HINTS[fig.id]) return VISUAL_HINTS[fig.id];
    const english = String(fig.name_en || fig.name || '').trim();
    if (series.id === 'series-28') return `person wearing a ${english} animal costume`;
    return english;
  }

  function uniqueLabel(base, lookup) {
    let label = base;
    let suffix = 2;
    while (lookup.has(label)) label = `${base} variant ${suffix++}`;
    return label;
  }

  function buildPromptIndex() {
    const labels = [];
    const lookup = new Map();

    for (const series of data) {
      const figures = Array.isArray(series.figures) ? series.figures : [];
      if (!figures.length) continue;

      if (isModernSeries(series)) {
        for (const fig of figures) {
          const name = String(fig.name_en || fig.name || '').trim();
          const description = visualDescription(series, fig);
          const base = `LEGO collectible minifigure ${description}; character ${name}; from ${series.name}`;
          const label = uniqueLabel(base, lookup);
          labels.push(label);
          lookup.set(label, {series, fig});

          if (fig.id === 'series-29-11') {
            const alt = uniqueLabel('LEGO minifigure cute anime-style witch girl with purple hat, pale blue hair, pink bow and a small grey cat', lookup);
            labels.push(alt);
            lookup.set(alt, {series, fig});
          }
        }
      } else {
        const names = figures.slice(0, 10).map(fig => fig.name_en || fig.name).filter(Boolean);
        const base = `LEGO collectible minifigure series featuring ${names.join(', ')}`;
        const label = uniqueLabel(base, lookup);
        labels.push(label);
        lookup.set(label, {series, fig:null});
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
      .visual-live-wrap{position:relative;overflow:hidden;border-radius:16px;background:#111827;aspect-ratio:3/4;max-height:62vh}.visual-live-video{width:100%;height:100%;object-fit:cover;display:block}.visual-live-guide{position:absolute;inset:10% 18%;border:2px solid rgba(255,255,255,.95);border-radius:24px;box-shadow:0 0 0 999px rgba(0,0,0,.28);pointer-events:none}.visual-live-guide:after{content:'Seul ce cadre sera analysé';position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);white-space:nowrap;color:#fff;background:rgba(17,24,39,.82);font-size:11px;font-weight:700;padding:5px 8px;border-radius:999px}
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
      <div class="visual-head"><div><div class="eyebrow">RECONNAISSANCE VISUELLE</div><h3>De quelle série vient cette figurine ?</h3></div><span class="visual-beta">BÊTA 2.9.2</span></div>
      <div class="visual-live-wrap"><video id="visualVideo" class="visual-live-video" autoplay playsinline muted></video><div class="visual-live-guide"></div></div>
      <div id="visualStatus" class="visual-status">Cadre la figurine entière dans le rectangle blanc, de face, avec le moins de décor possible autour.</div>
      <div id="visualProgress" class="visual-progress hidden"><span></span></div>
      <div id="visualResults" class="hidden"></div>
      <div class="visual-note">La V2.9.2 analyse uniquement la zone du cadre blanc et compare maintenant les figurines récentes une par une. Aucune photo n’est enregistrée par BrickScan.</div>
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
      setStatus('<strong>Caméra prête.</strong> Place toute la figurine dans le cadre blanc puis lance l’analyse.');
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
      const track = visualStream.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.() || {};
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        try { await track.applyConstraints({advanced:[{focusMode:'continuous'}]}); } catch (_) {}
      }
      setStatus('<strong>Caméra prête.</strong> Place toute la figurine dans le cadre blanc, de face.');
    } catch (error) {
      console.error('BrickScan V2.9.2 caméra visuelle', error);
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
    const displayW = Math.max(1, video.clientWidth || sourceW);
    const displayH = Math.max(1, video.clientHeight || sourceH);

    // Le flux est affiché avec object-fit: cover. On reconstruit donc la zone source
    // réellement située derrière le guide blanc (inset 10% vertical, 18% horizontal).
    const coverScale = Math.max(displayW / sourceW, displayH / sourceH);
    const renderedW = sourceW * coverScale;
    const renderedH = sourceH * coverScale;
    const cropOffsetX = (renderedW - displayW) / 2;
    const cropOffsetY = (renderedH - displayH) / 2;

    const guideX = displayW * 0.18;
    const guideY = displayH * 0.10;
    const guideW = displayW * 0.64;
    const guideH = displayH * 0.80;

    let sx = (guideX + cropOffsetX) / coverScale;
    let sy = (guideY + cropOffsetY) / coverScale;
    let sw = guideW / coverScale;
    let sh = guideH / coverScale;

    sx = Math.max(0, Math.min(sourceW - 1, sx));
    sy = Math.max(0, Math.min(sourceH - 1, sy));
    sw = Math.max(1, Math.min(sourceW - sx, sw));
    sh = Math.max(1, Math.min(sourceH - sy, sh));

    const maxSide = 720;
    const resizeScale = Math.min(1, maxSide / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(224, Math.round(sw * resizeScale));
    canvas.height = Math.max(224, Math.round(sh * resizeScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
      const meta = promptIndex.lookup.get(item.label);
      if (!meta?.series) continue;
      const score = Number(item.score) || 0;
      const current = bySeries.get(meta.series.id);
      if (!current || score > current.score) {
        bySeries.set(meta.series.id, {
          series: meta.series,
          score,
          figGuess: meta.fig ? {fig:meta.fig, score} : null
        });
      }
    }
    return [...bySeries.values()].sort((a,b) => b.score - a.score);
  }

  function confidenceText(top, second) {
    const ratio = top?.score / Math.max(second?.score || 0.000001, 0.000001);
    if (!top || top.score < 0.01 || ratio < 1.08) return 'Confiance faible';
    if (ratio >= 1.45) return 'Confiance forte';
    return 'Confiance moyenne';
  }

  function renderResults(ranked) {
    const box = document.getElementById('visualResults');
    if (!box || !ranked.length) return;
    const top = ranked[0];
    const second = ranked[1];
    const shown = ranked.slice(0,3);
    const max = Math.max(top.score, 0.000001);
    const confidence = confidenceText(top, second);
    const figGuess = top.figGuess;
    box.innerHTML = `
      <div class="visual-winner">
        <small>Série la plus probable · ${esc(confidence)}</small>
        <strong>${esc(top.series.name)}</strong>
        <p>${top.series.set ? `Set ${esc(top.series.set)}` : ''}${top.series.year ? ` · ${esc(top.series.year)}` : ''}${figGuess ? ` · Figurine probable : <b>${esc(figGuess.fig.name)}</b>` : ''}</p>
      </div>
      <div class="visual-alternatives">
        ${shown.map((item,index) => `<div class="visual-alt"><span class="visual-alt-name">${index===0?'✓ ':''}${esc(item.series.name)}${item.figGuess ? ` · ${esc(item.figGuess.fig.name)}` : ''}</span><span class="visual-alt-bar"><span style="width:${Math.max(8, Math.round(item.score/max*100))}%"></span></span></div>`).join('')}
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
    setStatus('<strong>Analyse de la zone cadrée…</strong>');
    setProgress(2, true);

    try {
      const model = await loadClassifier();
      setStatus(`<strong>Comparaison visuelle…</strong><br>${promptIndex.labels.length} profils visuels sont testés.`);
      setProgress(94, true);
      const output = await model(frame, promptIndex.labels, {hypothesis_template:'This is a photo of {}'});
      const ranked = aggregateSeries(output);
      if (!ranked.length) throw new Error('Aucune série candidate');
      setProgress(100, true);
      renderResults(ranked);
      setStatus(`<strong>Analyse terminée.</strong> ${confidenceText(ranked[0], ranked[1])}. Pour confirmer, tu peux tourner légèrement la figurine et relancer.`);
      setTimeout(() => setProgress(0, false), 700);
    } catch (error) {
      console.error('BrickScan V2.9.2 visual scan', error);
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