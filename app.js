// Add more buttons here.
const ACTIONS = [
  { id: 'price', label: '💲 Price it', question: 'Price this item on eBay (sold listings) and Amazon. Give a likely resale range.' },
  { id: 'identify', label: '🔍 Identify it', question: 'What is this item? Identify brand, model, and anything notable.' },
  { id: 'fix', label: '🔧 How to fix it', question: 'How do I fix this item? Give likely problems and step-by-step repair.' },
];
const MAX_DIM = 1600, QUALITY = 0.85;
const $ = id => document.getElementById(id);
const video = $('video'), still = $('still'), statusEl = $('status');
let stream = null, pendingAction = null;
let batch = []; // JPEG data URLs waiting to be sent (multi-shot)

// Phone setup link from setup.html: #hook=<url>&auth=<header>. The fragment never reaches a server; clear it right away.
let setupSaved = false;
if (location.hash.length > 1) {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('hook')) {
    const u = (h.get('hook') || '').trim(), k = cleanAuth(h.get('auth'));
    if (/^https?:\/\//i.test(u)) {
      localStorage.setItem('hookUrl', u);
      k ? localStorage.setItem('hookAuth', k) : localStorage.removeItem('hookAuth');
      setupSaved = true;
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// ?hook= param
const params = new URLSearchParams(location.search);
if (params.get('hook')) { localStorage.setItem('hookUrl', params.get('hook')); history.replaceState(null, '', location.pathname); }

function setStatus(cls, text) { statusEl.className = cls || ''; statusEl.textContent = text || ''; }

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no gUM');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream; await video.play().catch(() => {});
    video.hidden = false; $('nocam').hidden = true; $('shutter').hidden = false;
  } catch (e) { video.hidden = true; $('nocam').hidden = false; $('shutter').hidden = true; }
  renderStrip();
}

function drawToJpeg(src, w, h) {
  const s = Math.min(1, MAX_DIM / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', QUALITY);
}

function loadFile(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => res(img); img.onerror = rej; img.src = url;
  });
}

function cleanAuth(v) { return (v || '').trim().replace(/^authorization\s*:\s*/i, ''); }
function postPayload(url, auth, payload) {
  const headers = { 'Content-Type': 'application/json' };
  auth = cleanAuth(auth); if (auth) headers['Authorization'] = auth;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
}

// Batch sending: one request per photo, same payload as before. When there is more than one
// photo, each request also carries batch_id, batch_index (1-based), batch_count and batch_label ("i of n").
function newBatchId() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }
async function sendBatch(action, shots, batchId, startAt) {
  const url = localStorage.getItem('hookUrl');
  if (!url) { setStatus('failed', 'No webhook URL set. Tap ⚙️'); openSettings(); return; }
  const n = shots.length; batchId = batchId || newBatchId(); startAt = startAt || 0;
  setButtons(true);
  let i = startAt;
  try {
    for (; i < n; i++) {
      setStatus('sending', n > 1 ? `Sending “${action.label}” ${i + 1} of ${n}…` : `Sending “${action.label}”…`);
      const payload = { question: action.question, action: action.id, image_base64: shots[i].split(',')[1], mime: 'image/jpeg', timestamp: new Date().toISOString() };
      if (n > 1) Object.assign(payload, { batch_id: batchId, batch_index: i + 1, batch_count: n, batch_label: `${i + 1} of ${n}` });
      const r = await postPayload(url, localStorage.getItem('hookAuth'), payload);
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }
    setStatus('sent', n > 1 ? `✓ Sent ${n} photos!` : '✓ Sent!');
  } catch (e) {
    const where = n > 1 ? ` on photo ${i + 1} of ${n}` : '';
    setStatus('failed', '✗ Failed' + where + ': ' + e.message + ' — tap to retry');
    const at = i; statusEl.onclick = () => { statusEl.onclick = null; sendBatch(action, shots, batchId, at); };
  } finally { setButtons(false); }
}

function captureFrame() {
  if (!(stream && video.videoWidth)) return null;
  return drawToJpeg(video, video.videoWidth, video.videoHeight);
}

function renderStrip() {
  const strip = $('strip'); strip.textContent = '';
  batch.forEach((d, i) => {
    const b = document.createElement('button'); b.title = 'Remove photo ' + (i + 1);
    const img = document.createElement('img'); img.src = d; img.alt = 'Photo ' + (i + 1);
    const x = document.createElement('span'); x.textContent = '×';
    b.append(img, x); b.onclick = () => { batch.splice(i, 1); renderStrip(); };
    strip.appendChild(b);
  });
  $('done').hidden = !(batch.length && stream);
  document.querySelectorAll('#actions button').forEach(b => { b.textContent = b.dataset.label + (batch.length > 1 ? ` (${batch.length})` : ''); });
  if (batch.length) setStatus('', `${batch.length} photo${batch.length > 1 ? 's' : ''} ready — add more or pick an action`);
  else if (!statusEl.className) setStatus('', '');
}

$('shutter').onclick = () => {
  const d = captureFrame(); if (!d) return;
  batch.push(d); renderStrip();
  video.style.opacity = '.3'; setTimeout(() => video.style.opacity = '', 120);
};
$('done').onclick = () => { setStatus('', `${batch.length} photo${batch.length > 1 ? 's' : ''} ready — pick an action below`); $('actions').scrollIntoView({ behavior: 'smooth' }); };

async function onAction(action) {
  statusEl.onclick = null;
  if (batch.length) { const shots = batch; batch = []; renderStrip(); return sendBatch(action, shots); }
  const d = captureFrame(); if (d) return sendBatch(action, [d]);
  pendingAction = action; $('file').click();
}

// Fallback picker: adds every chosen photo to the same batch; can be used again and again.
$('file').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) { pendingAction = null; return; }
  let bad = 0;
  for (const f of files) {
    try { const img = await loadFile(f); batch.push(drawToJpeg(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); }
    catch { bad++; }
  }
  if (pendingAction) { const a = pendingAction; pendingAction = null; const shots = batch; batch = []; renderStrip(); if (shots.length) return sendBatch(a, shots); }
  renderStrip();
  if (bad) setStatus('failed', `Could not read ${bad} photo${bad > 1 ? 's' : ''}`);
});
$('filebtn').onclick = () => { pendingAction = null; $('file').click(); };

function setButtons(dis) { document.querySelectorAll('#actions button').forEach(b => b.disabled = dis); }
ACTIONS.forEach(a => { const b = document.createElement('button'); b.className = 'bigbtn'; b.dataset.label = a.label; b.textContent = a.label; b.onclick = () => onAction(a); $('actions').appendChild(b); });

function openSettings() { $('hookUrl').value = localStorage.getItem('hookUrl') || ''; $('hookAuth').value = localStorage.getItem('hookAuth') || ''; $('testResult').textContent = setupSaved ? 'Settings saved, tap Test send.' : ''; setupSaved = false; $('settings').hidden = false; }
$('gear').onclick = openSettings;
$('close').onclick = () => $('settings').hidden = true;
$('save').onclick = () => {
  const u = $('hookUrl').value.trim(), k = cleanAuth($('hookAuth').value);
  u ? localStorage.setItem('hookUrl', u) : localStorage.removeItem('hookUrl');
  k ? localStorage.setItem('hookAuth', k) : localStorage.removeItem('hookAuth');
  localStorage.removeItem('hookKey');
  $('settings').hidden = true; setStatus('sent', 'Settings saved');
};

$('test').onclick = async () => {
  const out = $('testResult'), url = $('hookUrl').value.trim();
  if (!url) { out.textContent = '✗ Enter a Webhook URL first.'; return; }
  out.textContent = 'Sending test…';
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const payload = { question: 'Test from camera app', action: 'test', image_base64: c.toDataURL('image/jpeg', 0.5).split(',')[1], mime: 'image/jpeg', timestamp: new Date().toISOString() };
  try {
    const r = await postPayload(url, $('hookAuth').value, payload);
    out.textContent = (r.ok ? '✓ ' : '✗ ') + 'HTTP ' + r.status + ' ' + r.statusText;
  } catch (e) {
    out.textContent = '✗ Network/CORS error (' + e.message + '). The endpoint may be unreachable or blocking browser requests: it must allow CORS from ' + location.origin + ' including the Content-Type and Authorization headers (OPTIONS preflight).';
  }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
startCamera();
if (setupSaved) setStatus('sent', 'Settings saved, tap Test send.'), openSettings();
document.addEventListener('visibilitychange', () => { if (!document.hidden && stream && !stream.active) startCamera(); });
