# Camera Quick Actions

PWA: point camera, tap an action, POSTs JSON `{question, action, image_base64, mime, timestamp}` to a webhook set in Settings (⚙️) or via `?hook=`. Optional Authorization header value (e.g. `Bearer xyz`) sent as the HTTP `Authorization` header. Settings has a Test send button. Add buttons in the `ACTIONS` array in app.js.
