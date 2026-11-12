/* The installer boards: Interleaf's web form (spec 002), built in the page from this checkout's
   interleaf/tokens.json, which the preview serves as ds/interleaf/tokens.json. It writes the same
   custom properties tools/gen-interleaf writes to web/tokens.css (a board can't load web/), so
   the boards and the real installer pages read one set of names: data-theme="<id>" and
   data-pen="1|2|3" on the element that holds a screen. bundle.css comes in by its own <link>.
   Also: INSTALLER_THEME(voice, scheme), the data-theme id of the web form (web/combinations.json). */
(function () {
  var FALLBACK = { 'stationery-eink': 'eink' };
  var ALIASES = { eink: ['white-eink', 'editorial-eink'] };
  var WEB_THEME = { 'white-eink': 'white-eink', 'editorial-eink': 'editorial-eink', 'stationery-eink': 'stationery-eink' };
  window.INSTALLER_THEME = function (voice, scheme) {
    var v = voice || 'white', s = scheme || 'paper';
    return WEB_THEME[v + '-' + s] || (v + '-' + s);
  };
  if (window.__installerTokens) return;
  window.__installerTokens = true;
  function val(v) { var m = /^\{([a-z0-9-]+)\}$/.exec(String(v).trim()); return m ? 'var(--' + m[1] + ')' : v; }
  function raw(t, theme) {
    if (typeof t.value !== 'object') return t.value;
    for (var th = theme; th; th = FALLBACK[th]) if (t.value[th] !== undefined) return t.value[th];
    return undefined;
  }
  function build(j) {
    var out = [], themes = j.color.themes.map(function (t) { return t.id; });
    var themed = [].concat(j.color.tokens, j.shadow.tokens).filter(function (t) { return typeof t.value === 'object'; });
    themes.forEach(function (th, i) {
      var sel = [th].concat(ALIASES[th] || []).map(function (id) { return '[data-theme="' + id + '"]'; }).join(', ');
      if (i === 0) sel = ':root, ' + sel;
      out.push(sel + ' {');
      themed.forEach(function (t) { var v = raw(t, th); if (v !== undefined) out.push('  --' + t.name + ': ' + val(v) + ';'); });
      out.push('}');
    });
    [2, 3].forEach(function (p) {
      out.push(':root[data-pen="' + p + '"], [data-theme][data-pen="' + p + '"] { --accent: var(--accent-' + p + '); --highlight: var(--highlight-' + p + '); }');
    });
    out.push(':root {');
    [j.color, j.spacing, j.radius, j.layout, j.stroke].forEach(function (sec) {
      (sec.tokens || []).forEach(function (t) { if (typeof t.value !== 'object') out.push('  --' + t.name + ': ' + val(t.value) + ';'); });
    });
    Object.keys(j.type.families).forEach(function (k) { out.push('  --font-' + k + ': ' + j.type.families[k] + ';'); });
    out.push('}');
    return out.join('\n');
  }
  fetch('ds/interleaf/tokens.json').then(function (r) { return r.json(); }).then(function (j) {
    var st = document.createElement('style');
    st.setAttribute('data-from', 'interleaf/tokens.json');
    st.textContent = build(j);
    document.head.insertBefore(st, document.head.firstChild);
  });
})();
