(() => {
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
  const resultCard = $('resultCard');
  const unknownCard = $('unknownCard');
  const manualInput = $('manualInput');
  const manualBtn = $('manualBtn');
  const scanAgainBtn = $('scanAgainBtn');
  if (!video || !startBtn || !stopBtn || !manualInput || !manualBtn) return;

  let stream = null;
  let detector = null;
  let zxingReader = null;
  let zxingPromise = null;
  let scanning = false;
  let busyNative = false;
  let busyZXing = false;
  let torchOn = false;
  let lastNative = 0;
  let lastZXing = 0;
  let cropPass = 0;
  let raf = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently:true});

  function setStatus(text, kind='') {
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function loadZXing() {
    if (window.ZXing?.MultiFormatReader) return Promise.resolve(true);
    if (zxingPromise) return zxingPromise;
    zxingPromise = new Promise(resolve => {
      const existing = document.querySelector('script[data-brickscan-zxing]');
      if (existing) {
        existing.addEventListener('load', () => resolve(Boolean(window.ZXing?.MultiFormatReader)), {once:true});
        existing.addEventListener('error', () => resolve(false), {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = ZXING_URL;
      script.async = true;
      script.dataset.brickscanZxing = 'true';
      script.onload = () => resolve(Boolean(window.ZXing?.MultiFormatReader));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
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
    } catch (e) {
      console.warn('BrickScan ZXing init', e);
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

  function drawCrop(scale=0.66) {
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh || !ctx) return false;

    const side = Math.max(180, Math.floor(Math.min(vw, vh) * scale));
    const sx = Math.max(0, Math.floor((vw - side) / 2));
    const sy = Math.max(0, Math.floor((vh - side) / 2));
    const target = scale < 0.58 ? 720 : 640;
    canvas.width = target;
    canvas.height = target;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, target, target);
    return true;
  }

  function imageDataToLuminance(imageData) {
    const rgba = imageData.data;
    const out = new Uint8ClampedArray(imageData.width * imageData.height);
    for (let i=0, p=0; i<rgba.length; i+=4, p++) {
      out[p] = ((rgba[i] * 77 + rgba[i+1] * 150 + rgba[i+2] * 29) >> 8);
    }
    return out;
  }

  function decodeZXingCanvas() {
    if (!zxingReader || !ctx) return '';
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lum = imageDataToLuminance(imageData);
    const source = new ZXing.RGBLuminanceSource(lum, canvas.width, canvas.height);

    const attempts = [
      () => new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source)),
      () => typeof ZXing.GlobalHistogramBinarizer === 'function'
        ? new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(source))
        : null,
      () => new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source.invert()))
    ];

    for (const makeBitmap of attempts) {
      try {
        const bitmap = makeBitmap();
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

  function handoffRaw(raw, source='camera-v27') {
    const text = String(raw || '').trim();
    if (!text) return false;
    manualInput.value = text;
    manualBtn.click();
    const identified = !resultCard?.classList.contains('hidden');
    if (identified) {
      stopLive(false);
      setStatus(source.includes('zxing') ? 'Code identifié ✓ · moteur renforcé' : 'Code identifié ✓');
      return true;
    }
    return false;
  }

  async function tryNative() {
    if (!detector || busyNative || video.readyState < 2) return false;
    busyNative = true;
    try {
      const codes = await detector.detect(video);
      for (const code of codes || []) {
        if (handoffRaw(code.rawValue || '', 'camera-native')) return true;
      }
      // Deuxième chance sur un crop central agrandi.
      if (drawCrop(0.62)) {
        const cropped = await detector.detect(canvas);
        for (const code of cropped || []) {
          if (handoffRaw(code.rawValue || '', 'camera-native-crop')) return true;
        }
      }
    } catch (_) {
    } finally {
      busyNative = false;
    }
    return false;
  }

  async function tryZXing() {
    if (busyZXing || video.readyState < 2) return false;
    if (!zxingReader && !buildZXingReader()) return false;
    busyZXing = true;
    try {
      // Alterne un cadrage moyen et un cadrage serré. Le petit Data Matrix occupe
      // ainsi davantage de pixels sans demander à ZXing de décoder toute la vidéo HD.
      const scale = cropPass++ % 2 === 0 ? 0.66 : 0.48;
      if (!drawCrop(scale)) return false;
      const raw = decodeZXingCanvas();
      return raw ? handoffRaw(raw, 'camera-zxing') : false;
    } catch (_) {
      return false;
    } finally {
      busyZXing = false;
    }
  }

  async function scanLoop(ts) {
    if (!scanning) return;
    if (ts - lastNative >= 170) {
      lastNative = ts;
      if (await tryNative()) return;
    }
    if (ts - lastZXing >= 520) {
      lastZXing = ts;
      if (await tryZXing()) return;
    }
    if (scanning) raf = requestAnimationFrame(scanLoop);
  }

  async function setupTrack() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    const advanced = [];
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) advanced.push({focusMode:'continuous'});
    if (advanced.length) {
      try { await track.applyConstraints({advanced}); } catch (_) {}
    }
    if (caps.torch) torchBtn?.classList.remove('hidden');
    if (caps.zoom && zoom && zoomWrap) {
      zoom.min = caps.zoom.min;
      zoom.max = caps.zoom.max;
      zoom.step = caps.zoom.step || 0.1;
      const ideal = Math.min(Math.max(1.7, caps.zoom.min), caps.zoom.max);
      zoom.value = ideal;
      zoomWrap.classList.remove('hidden');
      try { await track.applyConstraints({advanced:[{zoom:ideal}]}); } catch (_) {}
    }
  }

  async function startLive() {
    resultCard?.classList.add('hidden');
    unknownCard?.classList.add('hidden');
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('La caméra nécessite HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Ce navigateur ne permet pas l’accès caméra.');
      return;
    }

    await stopLive(false);
    startBtn.disabled = true;
    setStatus('Ouverture de la caméra…');

    try {
      const zxingLoading = loadZXing();
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{
          facingMode:{ideal:'environment'},
          width:{ideal:1920},
          height:{ideal:1080},
          frameRate:{ideal:30, max:30}
        }
      });
      video.srcObject = stream;
      video.setAttribute('playsinline','');
      video.muted = true;
      await video.play();
      placeholder?.classList.add('hidden');
      nativeScanner?.classList.remove('hidden');
      scanning = true;
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      await setupTrack();

      const nativeOk = await buildNativeDetector();
      const zxingOk = await zxingLoading;
      if (zxingOk) buildZXingReader();

      if (nativeOk && zxingOk) setStatus('Caméra active · double moteur Data Matrix');
      else if (nativeOk) setStatus('Caméra active · moteur Data Matrix natif');
      else if (zxingOk) setStatus('Caméra active · moteur Data Matrix renforcé');
      else setStatus('Caméra active · utilise « Photo du code » pour identifier');

      lastNative = 0; lastZXing = 0; cropPass = 0;
      raf = requestAnimationFrame(scanLoop);
    } catch (e) {
      console.error('BrickScan V2.7 caméra', e);
      await stopLive(false);
      if (e?.name === 'NotAllowedError') setStatus('Accès caméra refusé. Autorise la caméra dans Chrome.');
      else if (e?.name === 'NotFoundError') setStatus('Aucune caméra arrière disponible.');
      else setStatus(`Impossible d’ouvrir la caméra${e?.name ? ' · '+e.name : ''}`);
    }
  }

  async function stopLive(resetStatus=true) {
    scanning = false;
    busyNative = false;
    busyZXing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    detector = null;
    torchOn = false;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) {
      try { video.pause(); } catch (_) {}
      video.srcObject = null;
    }
    placeholder?.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    torchBtn?.classList.add('hidden');
    zoomWrap?.classList.add('hidden');
    if (resetStatus) setStatus('Prêt · v2.7');
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

  // Capture avant les handlers historiques d'app.js : le direct est désormais géré ici.
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#startBtn')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      startLive();
      return;
    }
    if (event.target?.closest?.('#stopBtn')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      stopLive(true);
      return;
    }
    if (event.target?.closest?.('#torchBtn')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      toggleTorch();
      return;
    }
    if (event.target?.closest?.('#scanAgainBtn')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      resultCard?.classList.add('hidden');
      startLive();
      return;
    }
    const nav = event.target?.closest?.('.nav-btn');
    if (nav && nav.dataset.view !== 'scanView' && scanning) stopLive(false);
  }, true);

  zoom?.addEventListener('input', event => {
    if (!scanning) return;
    event.stopImmediatePropagation();
    applyZoom();
  }, true);

  photoInput?.addEventListener('change', () => {
    if (scanning) stopLive(false);
  }, true);

  window.addEventListener('pagehide', () => stopLive(false));
})();
