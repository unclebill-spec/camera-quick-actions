# Camera Quick Actions

PWA: point camera, tap an action, POSTs JSON `{question, action, image_base64, mime, timestamp}` to a webhook set in Settings (⚙️) or via `?hook=`. Optional key sent as `X-Webhook-Key` header. Add buttons in the `ACTIONS` array in app.js.
