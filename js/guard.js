/* eslint-disable */
/**
 * GUARDIA DE ERRORES DEL DASHBOARD
 *
 * Motivo: un panel que falla en silencio es indistinguible de uno que no
 * tiene nada. Hoy el dashboard servia 200 en todo y se veia en blanco, y
 * no habia forma de saber desde adentro si era un error de JS, un fetch
 * caido, o simplemente que no habia datos. Este archivo convierte eso en
 * algo visible.
 *
 * Se carga PRIMERO, antes de cualquier modulo, para no perder ningun
 * error del arranque.
 */
(function () {
  'use strict';
  if (window.__ecoGuard) return;
  window.__ecoGuard = { errores: [], fetchFallidos: [] };

  var MAX = 20;
  var errores = window.__ecoGuard.errores;

  function txt(s) {
    return String(s == null ? '' : s);
  }

  function pintar() {
    var b = document.getElementById('eco-error-banner');
    if (!b) return;
    var todo = window.__ecoGuard.errores.slice(-MAX)
      .concat(window.__ecoGuard.fetchFallidos.slice(-MAX).map(function (f) {
        return { msg: 'No se pudo cargar ' + f.url, url: f.url, why: f.why };
      }));
    if (!todo.length) { b.style.display = 'none'; b.innerHTML = ''; return; }
    b.style.display = 'block';
    b.innerHTML =
      '<div class="eco-err-head">' +
        '&#9888; ' + todo.length + ' problema(s) en esta carga. El panel puede estar incompleto.' +
        ' <button type="button" id="eco-err-toggle" class="eco-err-btn">ver</button>' +
      '</div>' +
      '<ol class="eco-err-list" id="eco-err-list" hidden>' +
        todo.map(function (e) {
          return '<li><code>' + txt(e.msg).slice(0, 300) + '</code>' +
            (e.where ? '<span class="eco-err-where">' + txt(e.where) + '</span>' : '') +
            '</li>';
        }).join('') +
      '</ol>';
    var t = document.getElementById('eco-err-toggle');
    if (t) t.onclick = function () {
      var l = document.getElementById('eco-err-list');
      if (l) l.hidden = !l.hidden;
      t.textContent = (l && !l.hidden) ? 'ocultar' : 'ver';
    };
  }

  window.__ecoGuard.pintar = pintar;

  window.addEventListener('error', function (e) {
    var msg = e.message || (e.error && e.error.message) || 'error desconocido';
    var where = '';
    if (e.filename) {
      where = e.filename.split('/').pop() + ':' + (e.lineno || '?');
    }
    errores.push({ msg: msg, where: where });
    try { pintar(); } catch (x) {  }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var msg = (r && (r.message || r)) || 'promesa rechazada sin motivo';
    errores.push({ msg: txt(msg) });
    try { pintar(); } catch (x) {  }
  });

  // Un fetch caido es la causa numero uno de "no carga nada". Se intercepta
  // para poder nombrarla en vez de dejar un div vacio.
  var fetchOrig = window.fetch;
  if (fetchOrig) {
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url);
      return fetchOrig.apply(this, arguments).then(function (r) {
        if (!r.ok) {
          window.__ecoGuard.fetchFallidos.push({ url: url, why: 'HTTP ' + r.status });
          try { pintar(); } catch (x) {  }
        }
        return r;
      }).catch(function (err) {
        window.__ecoGuard.fetchFallidos.push({
          url: url, why: (err && err.message) || 'sin conexion o CORS'
        });
        try { pintar(); } catch (x) {  }
        throw err;
      });
    };
  }

  // Poner el banner apenas exista el body.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('div');
      b.id = 'eco-error-banner';
      b.style.cssText = 'display:none;position:sticky;top:0;z-index:9999;' +
        'background:#2a1414;color:#ffd7d7;border-bottom:1px solid #7a2b2b;' +
        'padding:8px 12px;font-size:0.82rem;line-height:1.45;';
      document.body.insertBefore(b, document.body.firstChild);
      pintar();
    });
  }
})();
