(() => {
  const VERSION = '2.12.0';
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js';
  const $ = id => document.getElementById(id);
  const video = $('video');
  const status = $('scanStatus');
  const placeholder = $('scannerPlaceholder');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const torchBtn = $('torchBtn');
  const zoomWrap = $('zoomWrap');
  const zoom = $('zoom');
  const photoInput = $('photoInput');
  const nativeScanner = $('nativeScanner');
  const fallbackScanner = $('fallbackScanner');
  const resultCard = $('resultCard');
  const resultName = $('resultName');
  const resultSeries = $('resultSeries');
  const unknownCard = $('unknownCard');
  const manualInput = $('manualInput');
  const manualBtn = $('manualBtn');
  const scanAgainBtn = $('scanAgainBtn');
  if (!video || !startBtn || !stopBtn || !manualInput || !manualBtn || !scanAgainBtn) return;

  let stream = null;
  let detector = null;
  let zxingReader = null;
  let zxingPromise = null;
  let scanning = false;
  let paused = false;
  let busyNative = false;
  let busyZXing = false;
  let torchOn = false;
  let lastNative = 0;
  let lastZXing = 0;
  let cropPass = 0;
  let raf = 0;
  let lastAcceptedRaw = '';
  let lastDecodedAt = 0;
  let acceptedNeedsClear = false;
  let ignoreSameUntil = 0;
  let resumeNotBefore = 0;
  let batchMode = sessionStorage.getItem('brickscan-batch-mode') === '1';
  let batchCount = 0;
  let batchResumeTimer = null;
  let reopeningCamera = false;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  const setStatus = text => { if (status) status.textContent = text; };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function placeAgainButton() {
    if (!scanAgainBtn) return;
    // Le bouton reste dans la fiche résultat afin d'être visible immédiatement
    // après l'identification, au lieu d'être déplacé au-dessus de la fiche.
    scanAgainBtn.classList.add('full', 'hidden');
    scanAgainBtn.classList.remove('ghost');
    scanAgainBtn.classList.add('primary');
    scanAgainBtn.textContent = '📷 Scanner la suivante';
    scanAgainBtn.style.marginTop = '10px';
  }

  function showAgainButton() {
    if (batchMode) { hideAgainButton(); return; }
    placeAgainButton();
    scanAgainBtn.classList.remove('hidden');
  }

  function hideAgainButton() {
    scanAgainBtn.classList.add('hidden');
  }

  function injectBatchUi() {
    if ($('batchScanBtn')) return;
    const actions = startBtn.closest('.actions-row') || startBtn.parentElement;
    if (!actions) return;

    const style = document.createElement('style');
    style.id = 'batchScanStyles';
    style.textContent = `
      .batch-scan-btn.batch-active{background:#111827!important;color:#fff!important;border-color:#111827!important}
      .batch-scan-strip{margin-top:9px;padding:10px 11px;border-radius:13px;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px}.batch-scan-strip.hidden{display:none}.batch-scan-strip strong{font-size:12px}
      .batch-scan-last{margin-top:8px;padding:11px 12px;border-radius:13px;background:#dcfce7;border:1px solid #86efac;color:#166534;display:grid;gap:2px}.batch-scan-last.hidden{display:none}.batch-scan-last strong{font-size:13px}.batch-scan-last small{font-size:10px;color:#15803d}.batch-scan-pulse{animation:batchPulse .45s ease}@keyframes batchPulse{0%{transform:scale(.98);opacity:.55}100%{transform:scale(1);opacity:1}}
      body.batch-scan-active #resultCard,body.batch-scan-active #unknownCard{display:none!important}
      body.batch-scan-active #nativeScanner{display:block!important;background:#111827}
      body.batch-scan-active #video{display:block!important;visibility:visible!important;opacity:1!important}
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'batchScanBtn';
    btn.type = 'button';
    btn.className = 'btn secondary batch-scan-btn';
    btn.textContent = '🔁 Scan en série';
    actions.appendChild(btn);

    const strip = document.createElement('div');
    strip.id = 'batchScanStrip';
    strip.className = 'batch-scan-strip hidden';
    strip.innerHTML = '<span>🔁 <strong>Scan en série</strong></span><span id="batchScanCount">0 scannée</span>';

    const last = document.createElement('div');
    last.id = 'batchScanLast';
    last.className = 'batch-scan-last hidden';
    last.innerHTML = '<strong id="batchLastName"></strong><small id="batchLastSeries"></small>';

    if (status) {
      status.insertAdjacentElement('afterend', strip);
      strip.insertAdjacentElement('afterend', last);
    } else {
      actions.insertAdjacentElement('afterend', strip);
      strip.insertAdjacentElement('afterend', last);
    }

    btn.addEventListener('click', async event => {
      event.preventDefault();
      if (batchMode) {
        setBatchMode(false);
        await stopLive(true);
        return;
      }
      setBatchMode(true);
      resultCard?.classList.add('hidden');
      unknownCard?.classList.add('hidden');
      nativeScanner?.scrollIntoView({behavior:'smooth', block:'center'});
      await startLive();
      if (stream) setStatus('Scan en série · présente la première boîte');
    });

    updateBatchUi();
  }

  function setBatchMode(value) {
    batchMode = Boolean(value);
    sessionStorage.setItem('brickscan-batch-mode', batchMode ? '1' : '0');
    document.body.classList.toggle('batch-scan-active', batchMode);
    if (!batchMode) {
      clearTimeout(batchResumeTimer);
      batchResumeTimer = null;
      batchCount = 0;
      $('batchScanLast')?.classList.add('hidden');
    }
    updateBatchUi();
  }

  function updateBatchUi() {
    const btn = $('batchScanBtn');
    const strip = $('batchScanStrip');
    const count = $('batchScanCount');
    if (btn) {
      btn.textContent = batchMode ? '⏹ Terminer la série' : '🔁 Scan en série';
      btn.classList.toggle('batch-active', batchMode);
      btn.classList.toggle('primary', batchMode);
      btn.classList.toggle('secondary', !batchMode);
    }
    strip?.classList.toggle('hidden', !batchMode);
    if (count) count.textContent = `${batchCount} scannée${batchCount > 1 ? 's' : ''}`;
    if (batchMode) hideAgainButton();
  }

  function showBatchResult() {
    batchCount += 1;
    const box = $('batchScanLast');
    const name = $('batchLastName');
    const series = $('batchLastSeries');
    if (name) name.textContent = `✓ ${resultName?.textContent?.trim() || 'Figurine identifiée'}`;
    if (series) series.textContent = resultSeries?.textContent?.trim() || 'Prête pour la suivante';
    if (box) {
      box.classList.remove('hidden');
      box.classList.remove('batch-scan-pulse');
      void box.offsetWidth;
      box.classList.add('batch-scan-pulse');
    }
    updateBatchUi();
  }

  function loadZXing() {
    if (window.ZXing?.MultiFormatReader) return Promise.resolve(true);
    if (zxingPromise) return zxingPromise;
    zxingPromise = new Promise(resolve => {
      const old = document.querySelector('script[data-brickscan-zxing]');
      if (old) {
        if (window.ZXing?.MultiFormatReader) { resolve(true); return; }
        old.addEventListener('load', () => resolve(Boolean(window.ZXing?.MultiFormatReader)), {once:true});
        old.addEventListener('error', () => resolve(false), {once:true});
        setTimeout(() => resolve(Boolean(window.ZXing?.MultiFormatReader)), 1800);
        return;
      }
      const s = document.createElement('script');
      s.src = ZXING_URL;
      s.async = true;
      s.dataset.brickscanZxing = 'true';
      s.onload = () => resolve(Boolean(window.ZXing?.MultiFormatReader));
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return zxingPromise;
  }

  function buildZXingReader() {
    if (zxingReader || !window.ZXing?.MultiFormatReader) return Boolean(zxingReader);
    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.DATA_MATRIX, ZXing.BarcodeFormat.QR_CODE]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      zxingReader = new ZXing.MultiFormatReader();
      zxingReader.setHints(hints);
      return true;
    } catch (_) {
      zxingReader = null;
      return false;
    }
  }

  async function buildNativeDetector() {
    detector = null;
    if (!('BarcodeDetector' in window)) return false;
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = [];
      if (supported.includes('data_matrix')) formats.push('data_matrix');
      if (supported.includes('qr_code')) formats.push('qr_code');
      if (!formats.length) return false;
      detector = new BarcodeDetector({formats});
      return true;
    } catch (_) {
      return false;
    }
  }

  function waitForVideoFrame(timeout=900) {
    return new Promise(resolve => {
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(Boolean(value));
      };
      const timer = setTimeout(() => finish(false), timeout);

      if (typeof video.requestVideoFrameCallback === 'function') {
        try {
          video.requestVideoFrameCallback(() => finish(video.videoWidth > 0 && video.videoHeight > 0));
          return;
        } catch (_) {}
      }

      const started = Date.now();
      const poll = () => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) { finish(true); return; }
        if (Date.now() - started >= timeout) { finish(false); return; }
        requestAnimationFrame(poll);
      };
      poll();
    });
  }

  async function setupTrack() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      try { await track.applyConstraints({advanced:[{focusMode:'continuous'}]}); } catch (_) {}
    }
    if (caps.torch) torchBtn?.classList.remove('hidden');
    if (caps.zoom && zoom && zoomWrap) {
      zoom.min = caps.zoom.min;
      zoom.max = caps.zoom.max;
      zoom.step = caps.zoom.step || .1;
      const ideal = Math.min(Math.max(1.7, caps.zoom.min), caps.zoom.max);
      zoom.value = ideal;
      zoomWrap.classList.remove('hidden');
      try { await track.applyConstraints({advanced:[{zoom:ideal}]}); } catch (_) {}
    }
  }

  function attachStream() {
    if (!stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.setAttribute('playsinline','');
    video.muted = true;
    placeholder?.classList.add('hidden');
    nativeScanner?.classList.remove('hidden');
    fallbackScanner?.classList.add('hidden');
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  }

  async function openFreshCamera() {
    if (reopeningCamera) return false;
    reopeningCamera = true;
    try {
      if (!window.isSecureContext && location.hostname !== 'localhost') { setStatus('La caméra nécessite HTTPS.'); return false; }
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('Ce navigateur ne permet pas l’accès caméra.'); return false; }

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
      detector = null;

      const zxingLoading = loadZXing();
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}}
      });
      attachStream();
      await video.play();
      await setupTrack();
      const nativeOk = await buildNativeDetector();
      const zxingOk = await zxingLoading;
      if (zxingOk) buildZXingReader();
      const hasFrame = await waitForVideoFrame(1200);
      if (!hasFrame) throw new Error('Aucune image vidéo reçue');
      return nativeOk || zxingOk || hasFrame;
    } catch (error) {
      console.error('BrickScan V2.12 caméra', error);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
      return false;
    } finally {
      reopeningCamera = false;
    }
  }

  async function ensurePreviewAlive() {
    let track = stream?.getVideoTracks?.()[0];
    if (!stream || !track || track.readyState !== 'live' || track.muted) {
      setStatus('Réactivation de la caméra…');
      return openFreshCamera();
    }

    attachStream();
    try { await video.play(); } catch (_) {}
    if (await waitForVideoFrame(700)) return true;

    setStatus('Réactivation de l’image caméra…');
    await sleep(120);
    track = stream?.getVideoTracks?.()[0];
    if (track?.readyState === 'live') {
      try {
        video.srcObject = null;
        await sleep(60);
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline','');
        await video.play();
        if (await waitForVideoFrame(600)) return true;
      } catch (_) {}
    }

    return openFreshCamera();
  }

  function drawCrop(scale=.66) {
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh || !ctx) return false;
    const side = Math.max(180, Math.floor(Math.min(vw, vh) * scale));
    const sx = Math.max(0, Math.floor((vw - side) / 2));
    const sy = Math.max(0, Math.floor((vh - side) / 2));
    const target = scale < .58 ? 720 : 640;
    canvas.width = target;
    canvas.height = target;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, target, target);
    return true;
  }

  function imageDataToLuminance(imageData) {
    const rgba = imageData.data;
    const out = new Uint8ClampedArray(imageData.width * imageData.height);
    for (let i=0,p=0;i<rgba.length;i+=4,p++) out[p] = ((rgba[i]*77 + rgba[i+1]*150 + rgba[i+2]*29) >> 8);
    return out;
  }

  function decodeZXingCanvas() {
    if (!zxingReader || !ctx) return '';
    const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const source = new ZXing.RGBLuminanceSource(imageDataToLuminance(imageData), canvas.width, canvas.height);
    const tries = [
      () => new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source)),
      () => typeof ZXing.GlobalHistogramBinarizer === 'function' ? new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(source)) : null,
      () => new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source.invert()))
    ];
    for (const make of tries) {
      try {
        const bitmap = make();
        if (!bitmap) continue;
        const result = zxingReader.decodeWithState(bitmap);
        const text = result?.getText?.() || result?.text || '';
        if (text) return String(text);
      } catch (_) {
      } finally {
        try { zxingReader.reset(); } catch (_) {}
      }
    }
    return '';
  }

  function beginLoop() {
    paused = false;
    scanning = true;
    busyNative = false;
    busyZXing = false;
    lastNative = 0;
    lastZXing = 0;
    cropPass = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(scanLoop);
  }

  async function scheduleBatchResume() {
    clearTimeout(batchResumeTimer);
    const acceptedAt = Date.now();
    resumeNotBefore = acceptedAt + 550;
    ignoreSameUntil = acceptedAt + 900;
    resultCard?.classList.add('hidden');
    unknownCard?.classList.add('hidden');
    setStatus('Identifiée ✓ · présente la suivante');

    batchResumeTimer = setTimeout(async () => {
      batchResumeTimer = null;
      if (!batchMode) return;
      const alive = await ensurePreviewAlive();
      if (!batchMode) return;
      if (!alive) {
        setStatus('Caméra interrompue · touche « Terminer la série » puis relance');
        return;
      }
      beginLoop();
      setStatus(`Scan en série · ${batchCount} scannée${batchCount > 1 ? 's' : ''} · présente la suivante`);
    }, 600);
  }

  function pauseAfterResult() {
    paused = true;
    scanning = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;

    if (batchMode) {
      hideAgainButton();
      showBatchResult();
      scheduleBatchResume();
      return;
    }

    showAgainButton();
    setStatus('Code identifié ✓ · prêt pour le suivant');
  }

  function handoffRaw(raw) {
    const text = String(raw || '').trim();
    if (!text) return false;
    const now = Date.now();
    const gapSinceDecoded = lastDecodedAt ? now - lastDecodedAt : Infinity;
    lastDecodedAt = now;

    if (now < resumeNotBefore) return false;
    if (text === lastAcceptedRaw) {
      if (now < ignoreSameUntil) return false;
      if (acceptedNeedsClear && gapSinceDecoded < 1500) return false;
      if (gapSinceDecoded >= 1500) acceptedNeedsClear = false;
    }

    manualInput.value = text;
    manualBtn.click();
    const identified = !resultCard?.classList.contains('hidden');
    if (identified) {
      lastAcceptedRaw = text;
      acceptedNeedsClear = true;
      ignoreSameUntil = now + (batchMode ? 900 : 2200);
      pauseAfterResult();
      return true;
    }

    if (batchMode) {
      unknownCard?.classList.add('hidden');
      setStatus('Code lu mais inconnu · continue avec la suivante');
    }
    return false;
  }

  async function tryNative() {
    if (!detector || busyNative || video.readyState < 2 || paused) return false;
    busyNative = true;
    try {
      const codes = await detector.detect(video);
      for (const code of codes || []) if (handoffRaw(code.rawValue || '')) return true;
      if (drawCrop(.62)) {
        const cropped = await detector.detect(canvas);
        for (const code of cropped || []) if (handoffRaw(code.rawValue || '')) return true;
      }
    } catch (_) {
    } finally {
      busyNative = false;
    }
    return false;
  }

  async function tryZXing() {
    if (busyZXing || video.readyState < 2 || paused) return false;
    if (!zxingReader && !buildZXingReader()) return false;
    busyZXing = true;
    try {
      const scale = cropPass++ % 2 === 0 ? .66 : .48;
      if (!drawCrop(scale)) return false;
      const raw = decodeZXingCanvas();
      return raw ? handoffRaw(raw) : false;
    } catch (_) {
      return false;
    } finally {
      busyZXing = false;
    }
  }

  async function scanLoop(ts) {
    if (!scanning || paused) return;
    if (Date.now() < resumeNotBefore) { raf = requestAnimationFrame(scanLoop); return; }
    if (ts - lastNative >= 170) {
      lastNative = ts;
      if (await tryNative()) return;
    }
    if (ts - lastZXing >= 520) {
      lastZXing = ts;
      if (await tryZXing()) return;
    }
    if (scanning && !paused) raf = requestAnimationFrame(scanLoop);
  }

  async function ensureEngines() {
    const nativeOk = detector ? true : await buildNativeDetector();
    const zxingOk = zxingReader ? true : await loadZXing();
    if (zxingOk) buildZXingReader();
    return {nativeOk, zxingOk};
  }

  async function startLive() {
    resultCard?.classList.add('hidden');
    unknownCard?.classList.add('hidden');
    hideAgainButton();

    startBtn.disabled = true;
    try {
      const track = stream?.getVideoTracks?.()[0];
      let alive = false;
      if (stream && track?.readyState === 'live') alive = await ensurePreviewAlive();
      else alive = await openFreshCamera();

      if (!alive) {
        setStatus('Impossible de rétablir la caméra.');
        return false;
      }

      await ensureEngines();
      resumeNotBefore = 0;
      if (!lastAcceptedRaw) {
        ignoreSameUntil = 0;
        lastDecodedAt = 0;
        acceptedNeedsClear = false;
      }
      beginLoop();
      setStatus(batchMode ? 'Scan en série · présente une boîte' : 'Caméra active · lecture Data Matrix');
      return true;
    } catch (error) {
      console.error('BrickScan V2.12 startLive', error);
      setStatus(error?.name === 'NotAllowedError' ? 'Accès caméra refusé. Autorise la caméra dans Chrome.' : 'Impossible d’ouvrir la caméra.');
      return false;
    } finally {
      startBtn.disabled = false;
    }
  }

  async function resumeScan() {
    scanAgainBtn.disabled = true;
    resultCard?.classList.add('hidden');
    unknownCard?.classList.add('hidden');
    hideAgainButton();
    resumeNotBefore = Date.now() + 500;
    ignoreSameUntil = Date.now() + 2200;
    setStatus('Préparation du scan suivant…');
    nativeScanner?.scrollIntoView({behavior:'smooth', block:'center'});
    try {
      let ok = await startLive();
      if (!ok) {
        ok = await openFreshCamera();
        if (ok) beginLoop();
      }
      resumeNotBefore = Date.now() + 500;
      setStatus(ok ? 'Caméra prête · présente la figurine suivante' : 'Caméra indisponible · touche Scanner pour réessayer');
    } finally {
      scanAgainBtn.disabled = false;
    }
  }

  async function stopLive(resetStatus=true) {
    scanning = false;
    paused = false;
    busyNative = false;
    busyZXing = false;
    clearTimeout(batchResumeTimer);
    batchResumeTimer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    detector = null;
    torchOn = false;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    try { video.pause(); } catch (_) {}
    video.srcObject = null;
    placeholder?.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    torchBtn?.classList.add('hidden');
    zoomWrap?.classList.add('hidden');
    hideAgainButton();
    resumeNotBefore = 0;
    lastDecodedAt = 0;
    acceptedNeedsClear = false;
    if (resetStatus) setStatus(`Prêt · v${VERSION}`);
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    torchOn = !torchOn;
    try {
      await track.applyConstraints({advanced:[{torch:torchOn}]});
      if (torchBtn) torchBtn.textContent = torchOn ? '🔦 Lampe ON' : '🔦 Lampe';
    } catch (_) {}
  }

  async function applyZoom() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track || !zoom) return;
    try { await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]}); } catch (_) {}
  }

  placeAgainButton();
  injectBatchUi();
  document.body.classList.toggle('batch-scan-active', batchMode);

  startBtn.onclick = event => { event?.preventDefault(); startLive(); };
  stopBtn.onclick = event => {
    event?.preventDefault();
    if (batchMode) setBatchMode(false);
    stopLive(true);
  };
  if (torchBtn) torchBtn.onclick = event => { event?.preventDefault(); toggleTorch(); };
  scanAgainBtn.onclick = event => { event?.preventDefault(); resumeScan(); };
  if (zoom) zoom.oninput = () => { if (stream) applyZoom(); };

  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.view !== 'scanView' && (scanning || paused || stream)) {
      if (batchMode) setBatchMode(false);
      stopLive(false);
    }
  }));

  photoInput?.addEventListener('change', () => {
    if (batchMode) setBatchMode(false);
    if (stream) stopLive(false);
  }, true);

  if (resultCard) {
    const resultObserver = new MutationObserver(() => {
      if (!resultCard.classList.contains('hidden')) {
        if (batchMode) hideAgainButton();
        else showAgainButton();
      }
    });
    resultObserver.observe(resultCard, {attributes:true, attributeFilter:['class']});
  }

  window.addEventListener('pagehide', () => stopLive(false));
})();