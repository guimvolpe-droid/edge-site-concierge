// The embeddable widget — served at /widget.js, dropped into any site with one <script> tag.
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
  function add(html){ log.innerHTML += '<div style="margin:6px 0">' + html + '</div>'; log.scrollTop = log.scrollHeight; }
  box.querySelector('#sc-form').addEventListener('submit', async function(e){
    e.preventDefault();
    var input = box.querySelector('#sc-q');
    var q = input.value.trim(); if(!q) return;
    add('<b>You:</b> ' + q); input.value = '';
    try {
      var r = await fetch(ep + '/chat', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ question: q }) });
      var d = await r.json();
      var cites = (d.citations || []).map(function(c){ return '[' + c.n + '] ' + c.source; }).join('  ');
      add('<b>Site:</b> ' + d.text + (cites ? '<br><small style="color:#666">' + cites + '</small>' : ''));
    } catch (err) {
      add('<b>Site:</b> <span style="color:#b00">request failed</span>');
    }
  });
})();`;
