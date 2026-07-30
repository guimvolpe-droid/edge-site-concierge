// A tiny demo page that loads the widget — served at "/".
export const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>edge-site-concierge — demo</title>
</head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:48px auto;padding:0 16px;line-height:1.55;color:#111">
  <h1>edge-site-concierge</h1>
  <p>An embeddable AI concierge that answers <strong>only</strong> from this site's own content,
     with citations. When the answer is not in the content it says <em>"I don't know"</em>.</p>
  <ol>
    <li>Index content: <code>POST /ingest</code> with <code>{ "docs": [{ "source": "...", "text": "..." }] }</code>.</li>
    <li>Ask: use the widget (bottom-right) or <code>POST /chat</code> with <code>{ "question": "..." }</code>.</li>
  </ol>
  <p style="color:#666">The refusal gate rejects answers when retrieval confidence is low. That decision
     happens before the model is called.</p>
  <script>window.SC_ENDPOINT = '';</script>
  <script src="/widget.js"></script>
</body>
</html>`;
