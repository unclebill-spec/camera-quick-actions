// Add more buttons here.
const ACTIONS = [
  { id: 'price', label: '💲 Price it', question: 'Price this item on eBay (sold listings) and Amazon. Give a likely resale range.' },
  { id: 'identify', label: '🔍 Identify it', question: 'What is this item? Identify brand, model, and anything notable.' },
  { id: 'fix', label: '🔧 How to fix it', question: 'How do I fix this item? Give likely problems and step-by-step repair.' },
];
const MAX_DIM = 1600, QUALITY = 0.85;
const $ = id => document.getElementById(id);
const video = $('video'), still = $('still'), statusEl = $('status');
let stream = null, pendingAction = null, fileImage = null;

// ?hook= param
const params = new URLSearchParams(location.search);
if (params.get('hook')) { localStorage.setItem('hookUrl', params.get('hook')); history.replaceState(null, '', location.pathname); }

function setStatus(cls, text) { statusEl.className = cls || ''; statusEl.textContent = text || ''; }

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no gUM');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream; await video.play().catch(() => {});
  } catch (e) { video.hidden = true; $('nocam').hidden = false; }
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

async function send(action, dataUrl) {
  const url = localStorage.getItem('hookUrl');
  if (!url) { setStatus('failed', 'No webhook URL set. Tap ⚙️'); openSettings(); return; }
  setStatus('sending', `Sending “${action.label}”…`); setButtons(true);
  const payload = { question: action.question, action: action.id, image_base64: dataUrl.split(',')[1], mime: 'image/jpeg', timestamp: new Date().toISOString() };
  const headers = { 'Content-Type': 'application/json' };
  const key = localStorage.getItem('hookKey'); if (key) headers['X-Webhook-Key'] = key;
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setStatus('sent', '✓ Sent!');
  } catch (e) { setStatus('failed', '✗ Failed: ' + e.message + ' — tap to retry'); statusEl.onclick = () => { statusEl.onclick = null; send(action, dataUrl); }; }
  finally { setButtons(false); }
}

async function onAction(action) {
  statusEl.onclick = null;
  if (fileImage) { const img = fileImage; fileImage = null; still.hidden = true; return send(action, drawToJpeg(img, img.naturalWidth, img.naturalHeight)); }
  if (stream && video.videoWidth) return send(action, drawToJpeg(video, video.videoWidth, video.videoHeight));
  pendingAction = action; $('file').click();
}

$('file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const img = await loadFile(f);
    if (pendingAction) { const a = pendingAction; pendingAction = null; send(a, drawToJpeg(img, img.naturalWidth, img.naturalHeight)); }
    else { fileImage = img; still.src = img.src; still.hidden = false; setStatus('', 'Photo ready — pick an action'); }
  } catch { setStatus('failed', 'Could not read photo'); }
});
$('filebtn').onclick = () => { pendingAction = null; $('file').click(); };

function setButtons(dis) { document.querySelectorAll('#actions button').forEach(b => b.disabled = dis); }
ACTIONS.forEach(a => { const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = a.label; b.onclick = () => onAction(a); $('actions').appendChild(b); });

function openSettings() { $('hookUrl').value = localStorage.getItem('hookUrl') || ''; $('hookKey').value = localStorage.getItem('hookKey') || ''; $('settings').hidden = false; }
$('gear').onclick = openSettings;
$('close').onclick = () => $('settings').hidden = true;
$('save').onclick = () => {
  const u = $('hookUrl').value.trim(), k = $('hookKey').value.trim();
  u ? localStorage.setItem('hookUrl', u) : localStorage.removeItem('hookUrl');
  k ? localStorage.setItem('hookKey', k) : localStorage.removeItem('hookKey');
  $('settings').hidden = true; setStatus('sent', 'Settings saved');
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
startCamera();
document.addEventListener('visibilitychange', () => { if (!document.hidden && stream && !stream.active) startCamera(); });
