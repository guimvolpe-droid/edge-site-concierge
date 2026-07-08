// The embeddable widget — served at /widget.js, dropped into any site with one <script> tag.
// Streams answers over SSE (meta first: citations arrive before any token) and falls back
// to plain JSON when the response isn't a stream.
export const WIDGET_JS = `(function(){
  var ep = window.SC_ENDPOINT || '';
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;bottom:20px;right:20px;width:340px;z-index:2147483647;font-family:system-ui,sans-serif';
  box.innerHTML =
    '<div style="border:1px solid #e5e5e5;border-radius:12px;padding:12px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.12)">'
    + '<div style="font-weight:600;margin-bottom:8px">Ask this site</div>'
    + '<div id="sc-log" style="max-height:240px;overflow:auto;font-size:14px;line-height:1.45"></div>'
    + '<form id="sc-form" style="display:flex;gap:6px;margin-top:8px">'
    + '<input id="sc-q" autocomplete="off" placeholder="Ask a question..." style="flex:1;padding:8px;border:1px solid #ccc;border-radius:8px"/>'
    + '<button style="padding:8px 12px;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer">Ask</button>'
    + '</form></div>';
  document.body.appendChild(box);
  var log = box.querySelector('#sc-log');
  function add(html){
    var div = document.createElement('div');
    div.style.margin = '6px 0';
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function citesHtml(citations){
    var cites = (citations || []).map(function(c){ return '[' + c.n + '] ' + c.source; }).join('  ');
    return cites ? '<br><small style="color:#666">' + cites + '</small>' : '';
  }
  box.querySelector('#sc-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var input = box.querySelector('#sc-q');
    var q = input.value.trim(); if(!q) return;
    add('<b>You:</b> ' + q); input.value = '';
    try {
      var r = await fetch(ep + '/chat', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ question: q, stream: true }) });
      var ct = (r.headers.get('content-type') || '');
      if (!r.ok) throw new Error('http ' + r.status);
      if (!r.body || ct.indexOf('text/event-stream') < 0) {
        var d = await r.json();
        add('<b>Site:</b> ' + d.text + citesHtml(d.citations));
        return;
      }
      var row = add('<b>Site:</b> <span></span>');
      var textEl = row.querySelector('span');
      var meta = null;
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      for(;;){
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        // SSE frames can split across chunks: consume only complete lines, keep the tail.
        var lines = buf.split('\\n');
        buf = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf('data: ') !== 0) continue;
          var ev = JSON.parse(line.slice(6));
          if (ev.type === 'meta') meta = ev;
          if (ev.type === 'delta') { textEl.textContent += ev.text; log.scrollTop = log.scrollHeight; }
        }
      }
      if (meta) row.innerHTML += citesHtml(meta.citations);
    } catch (err) {
      add('<b>Site:</b> <span style="color:#b00">request failed</span>');
    }
  });
})();`;
