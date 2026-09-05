(() => {
  const data = window.MINIFIG_DATA || [];
  const codeIndex = new Map();
  const figIndex = new Map();
  for (const s of data) for (const f of s.figures) {
    const fig = {...f, seriesId:s.id, seriesName:s.name, set:s.set};
    figIndex.set(f.id, fig);
    for (const c of f.codes) codeIndex.set(String(c), fig);
  }

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

  let stream = null;
  let detector = null;
  let scanning = false;
  let scanBusy = false;
  let lastDetect = 0;
  let torchOn = false;
  let currentResult = null;
  let lastRaw = '';
  let deferredInstall = null;

  const loadSet = key => new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  const saveSet = (key,set) => localStorage.setItem(key, JSON.stringify([...set]));
  let owned = loadSet('brickscan-owned');
  let history = JSON.parse(localStorage.getItem('brickscan-history') || '[]');

  function setStatus(text, kind='') {
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function extractCandidates(raw) {
    const text = String(raw || '').trim();
    const matches = text.match(/(?:^|\D)(\d{7})(?=\D|$)/g) || [];
    const out = matches.map(v => (v.match(/\d{7}/)||[])[0]).filter(Boolean);
    if (/^\d{7}$/.test(text)) out.unshift(text);
    return [...new Set(out)];
  }

  function extractFactory(raw) {
    const m = String(raw||'').match(/\b\d{2,3}([RS])\d\b/i);
    if (!m) return '—';
    return m[1].toUpperCase()==='S' ? 'S · Europe' : 'R · Amériques';
  }

  function identify(raw, source='scan') {
    lastRaw = String(raw || '');
    const candidates = extractCandidates(lastRaw);
    const code = candidates.find(c => codeIndex.has(c));
    if (!code) {
      showUnknown(lastRaw, candidates[0] || '');
      return false;
    }
    const fig = codeIndex.get(code);
    showResult(fig, code, extractFactory(lastRaw));
    pushHistory(fig, code, source);
    if (navigator.vibrate) navigator.vibrate([50,40,80]);
    return true;
  }

  function showResult(fig, code, factory) {
    currentResult = fig;
    $('unknownCard')?.classList.add('hidden');
    $('resultCard')?.classList.remove('hidden');
    $('resultAvatar').textContent = fig.number;
    $('resultName').textContent = fig.name;
    $('resultSeries').textContent = `${fig.seriesName} · set ${fig.set}`;
    $('resultCode').textContent = code;
    $('resultFactory').textContent = factory;
    updateOwnedButton();
    $('resultCard').scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  function showUnknown(raw, candidate) {
    currentResult = null;
    $('resultCard')?.classList.add('hidden');
    $('unknownCard')?.classList.remove('hidden');
    $('unknownText').textContent = candidate
      ? `Identifiant candidat : ${candidate}\n${raw}`
      : String(raw || 'Aucun identifiant à 7 chiffres détecté.');
    $('unknownCard').scrollIntoView({behavior:'smooth', block:'nearest'});
  }

  function updateOwnedButton() {
    if (!currentResult) return;
    const yes = owned.has(currentResult.id);
    $('ownedBtn').textContent = yes ? '✓ Dans ma collection' : '＋ Ajouter à ma collection';
    $('ownedBtn').classList.toggle('secondary', yes);
    $('ownedBtn').classList.toggle('primary', !yes);
  }

  function pushHistory(fig, code, source) {
    const now = Date.now();
    if (history[0] && history[0].id===fig.id && now-history[0].ts<3000) return;
    history.unshift({id:fig.id, code, source, ts:now});
    history = history.slice(0,30);
    localStorage.setItem('brickscan-history', JSON.stringify(history));
  }

  async function buildDetector() {
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
    } catch (e) {
      console.warn('BarcodeDetector indisponible', e);
      return false;
    }
  }

  async function startScanner() {
    $('resultCard')?.classList.add('hidden');
    $('unknownCard')?.classList.add('hidden');

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus('La caméra nécessite HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Ce navigateur ne permet pas l’accès caméra.');
      return;
    }

    await stopScanner(false);
    startBtn.disabled = true;
    setStatus('Ouverture de la caméra…');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{
          facingMode:{ideal:'environment'},
          width:{ideal:1920},
          height:{ideal:1080}
        }
      });

      video.srcObject = stream;
      video.setAttribute('playsinline','');
      video.muted = true;
      await video.play();
      placeholder?.classList.add('hidden');
      nativeScanner?.classList.remove('hidden');
      fallbackScanner?.classList.add('hidden');

      scanning = true;
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      setupTrackControls();

      const canDecode = await buildDetector();
      setStatus(canDecode
        ? 'Caméra active · lecture Data Matrix en cours…'
        : 'Caméra active · utilise « Photo du code » pour identifier');

      if (canDecode) requestAnimationFrame(scanLoop);
    } catch (e) {
      console.error('Erreur caméra', e);
      await stopScanner(false);
      if (e?.name === 'NotAllowedError') setStatus('Accès caméra refusé. Autorise la caméra dans Chrome.');
      else if (e?.name === 'NotFoundError') setStatus('Aucune caméra arrière disponible.');
      else setStatus(`Impossible d’ouvrir la caméra${e?.name ? ' · '+e.name : ''}`);
    }
  }

  async function scanLoop(ts) {
    if (!scanning || !detector) return;
    if (!scanBusy && ts-lastDetect > 220 && video.readyState >= 2) {
      lastDetect = ts;
      scanBusy = true;
      try {
        const codes = await detector.detect(video);
        if (codes?.length) {
          const raw = codes[0].rawValue || '';
          if (raw && identify(raw, 'camera')) {
            await stopScanner(false);
            setStatus('Code identifié ✓');
            return;
          }
        }
      } catch (_) {
      } finally {
        scanBusy = false;
      }
    }
    if (scanning) requestAnimationFrame(scanLoop);
  }

  async function stopScanner(resetStatus=true) {
    scanning = false;
    scanBusy = false;
    detector = null;
    torchOn = false;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) {
      try { video.pause(); } catch(_) {}
      video.srcObject = null;
    }
    placeholder?.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    torchBtn.classList.add('hidden');
    zoomWrap.classList.add('hidden');
    if (resetStatus) setStatus('Prêt');
  }

  function setupTrackControls() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.() || {};
    if (caps.torch) torchBtn.classList.remove('hidden');
    if (caps.zoom) {
      zoom.min = caps.zoom.min;
      zoom.max = caps.zoom.max;
      zoom.step = caps.zoom.step || 0.1;
      zoom.value = Math.min(Math.max(2,caps.zoom.min),caps.zoom.max);
      zoomWrap.classList.remove('hidden');
      applyZoom();
    }
  }

  async function applyZoom() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    try { await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]}); } catch(_) {}
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    torchOn = !torchOn;
    try {
      await track.applyConstraints({advanced:[{torch:torchOn}]});
      torchBtn.textContent = torchOn ? '🔦 Lampe ON' : '🔦 Lampe';
    } catch(_) {}
  }

  function loadPhotoDecoder() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Bibliothèque de décodage indisponible'));
      document.head.appendChild(s);
    });
  }

  async function scanPhoto(file) {
    if (!file) return;
    await stopScanner(false);
    $('resultCard')?.classList.add('hidden');
    $('unknownCard')?.classList.add('hidden');
    setStatus('Analyse de la photo…');
    try {
      await loadPhotoDecoder();
      fallbackScanner.classList.remove('hidden');
      nativeScanner.classList.add('hidden');
      const formats = window.Html5QrcodeSupportedFormats
        ? [Html5QrcodeSupportedFormats.DATA_MATRIX, Html5QrcodeSupportedFormats.QR_CODE]
        : undefined;
      const reader = new Html5Qrcode('fallbackScanner', {formatsToSupport:formats, verbose:false});
      const result = await reader.scanFileV2(file, true);
      const raw = result?.decodedText || result?.decodedResult?.decodedText || '';
      try { await reader.clear(); } catch(_) {}
      fallbackScanner.classList.add('hidden');
      nativeScanner.classList.remove('hidden');
      if (!raw) throw new Error('Aucun code décodé');
      identify(raw, 'photo');
      setStatus('Code lu depuis la photo ✓');
    } catch (e) {
      console.error('Erreur photo', e);
      fallbackScanner.classList.add('hidden');
      nativeScanner.classList.remove('hidden');
      setStatus('Code non lu. Cadre uniquement le petit carré et reprends une photo nette.');
    } finally {
      if (photoInput) photoInput.value='';
    }
  }

  function renderCollection(filter='all') {
    const total = figIndex.size, count = owned.size;
    $('collectionStats').innerHTML=`<div class="stats-top"><span>Collection</span><strong>${count} / ${total}</strong></div><div class="progress"><span style="width:${total?count/total*100:0}%"></span></div>`;
    $('seriesFilters').innerHTML=['all',...data.map(s=>s.id)].map(id=>{
      const label=id==='all'?'Toutes':data.find(s=>s.id===id)?.name;
      return `<button class="filter-chip ${filter===id?'active':''}" data-filter="${id}">${label}</button>`;
    }).join('');
    $('seriesFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>renderCollection(b.dataset.filter));
    const figs=[...figIndex.values()].filter(f=>filter==='all'||f.seriesId===filter);
    $('collectionGrid').innerHTML=figs.map(f=>`<button class="fig-card ${owned.has(f.id)?'owned':''}" data-id="${f.id}"><div class="num">${f.number}</div>${owned.has(f.id)?'<div class="owned-mark">✓</div>':''}<h3>${escapeHtml(f.name)}</h3><small>${escapeHtml(f.seriesName)}</small></button>`).join('');
    $('collectionGrid').querySelectorAll('.fig-card').forEach(b=>b.onclick=()=>{
      const id=b.dataset.id;
      owned.has(id)?owned.delete(id):owned.add(id);
      saveSet('brickscan-owned',owned);
      renderCollection(filter);
    });
  }

  function renderHistory() {
    const rows=history.map(h=>{
      const f=figIndex.get(h.id); if(!f)return '';
      const d=new Date(h.ts);
      return `<div class="history-item"><div class="history-avatar">${f.number}</div><div class="history-copy"><strong>${escapeHtml(f.name)}</strong><small>${escapeHtml(f.seriesName)} · ${h.code}</small></div><div class="history-time">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}<br>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }).join('');
    $('historyList').innerHTML=rows||'<div class="empty">Aucun scan pour le moment.<br>Le premier trésor de boîte aveugle t’attend. 🧱</div>';
  }

  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}

  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    if (btn.dataset.view!=='scanView' && scanning) await stopScanner(false);
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b===btn));
    if(btn.dataset.view==='collectionView')renderCollection();
    if(btn.dataset.view==='historyView')renderHistory();
    window.scrollTo({top:0,behavior:'smooth'});
  }));

  startBtn.onclick=startScanner;
  stopBtn.onclick=()=>stopScanner(true);
  torchBtn.onclick=toggleTorch;
  zoom.oninput=applyZoom;
  photoInput?.addEventListener('change',e=>scanPhoto(e.target.files?.[0]));
  $('manualBtn').onclick=()=>{const v=$('manualInput').value.trim();if(v)identify(v,'manuel');};
  $('manualInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('manualBtn').click();});
  $('scanAgainBtn').onclick=()=>{$('resultCard').classList.add('hidden');startScanner();};
  $('ownedBtn').onclick=()=>{if(!currentResult)return;owned.has(currentResult.id)?owned.delete(currentResult.id):owned.add(currentResult.id);saveSet('brickscan-owned',owned);updateOwnedButton();};
  $('copyUnknown').onclick=async()=>{try{await navigator.clipboard.writeText(lastRaw);$('copyUnknown').textContent='Copié ✓';setTimeout(()=>$('copyUnknown').textContent='Copier le code',1200)}catch{}};
  $('clearCollection').onclick=()=>{if(confirm('Vider toute la collection ?')){owned.clear();saveSet('brickscan-owned',owned);renderCollection();}};
  $('clearHistory').onclick=()=>{history=[];localStorage.setItem('brickscan-history','[]');renderHistory();};

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden');});
  $('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hidden');};
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
})();
