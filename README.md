# Camera Quick Actions

PWA: point camera, tap an action, POSTs JSON `{question, action, image_base64, mime, timestamp}` to a webhook set in Settings (⚙️) or via `?hook=`. Optional Authorization header value (e.g. `Bearer xyz`) sent as the HTTP `Authorization` header. Settings has a Test send button. Add buttons in the `ACTIONS` array in app.js.

Batches: one POST per photo, same fields as before; when a batch has 2+ photos each POST also has `batch_id` (shared), `batch_index` (1-based), `batch_count`, `batch_label` ("2 of 3"). Single photos are unchanged.
Phone setup: open `setup.html` on a PC, paste the URL + key, scan the QR (settings travel in the URL #fragment; the app saves them and strips the fragment). QR made locally by vendor/qrcode.js (qrcode-generator 2.0.4, MIT).
