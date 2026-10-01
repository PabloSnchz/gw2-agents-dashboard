/**
 * js/rutas-dev.js — carga data/rutas-dev.json y abre la tab Promociones.
 *
 * POR QUÉ HAY UN MÓDULO APARTE PARA ESTO
 *
 * La tab Promociones necesita dos cosas que vienen de lugares distintos:
 * el contenido de PROMOTIONS.md (que dice QUÉ está esperando decisión) y la
 * lista de pantallas que la app de desarrollo tiene de verdad (que dice
 * DÓNDE se lo puede probar). La segunda no puede inventarse en el render: un
 * link a una ruta que no existe abre la portada de la app sin dar ningún error,
 * y Pablo pierde tiempo buscando algo que no está.
 *
 * Así que el render espera a que lleguen las dos antes de dibujar. Se hace
 * desde acá y no desde app.js para que el fallo sea de uno solo: si
 * rutas-dev.json no está, la tab se dibuja igual y lo dice en el lugar del
 * link, en vez de quedarse en blanco.
 */
(function () {
    'use strict';

    // renderer.js declara "class DashboardRenderer". Eso crea un binding
    // LEXICO del scope global, no una propiedad de window: window.DashboardRenderer
    // es undefined SIEMPRE, aunque la clase exista y funcione.
    //
    // Por eso la guarda de abajo chequeaba window.X y cortaba el render de
    // esta tab en silencio, sin error en consola y sin escribir nada. Se
    // chequea el binding, que es donde vive de verdad.
    function _renderer() {
        if (typeof DashboardRenderer !== 'undefined') return DashboardRenderer;
        return (typeof window !== 'undefined') ? window.DashboardRenderer : null;
    }

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Un fallo de render que no escribe nada deja la tab en blanco, que es
    // indistinguible de "no hay promociones". El motivo va al container.
    function _avisar(motivo) {
        var c = document.getElementById('promotions-container');
        if (!c) return;
        c.innerHTML = '<div class="promo-fallback">' +
            '<p class="promo-callout promo-callout--danger">' +
            'La tab Promociones no se pudo dibujar: ' + _esc(motivo) + '</p>' +
            '<button class="btn btn-secondary btn-sm" onclick="retryLoad()">Reintentar</button>' +
            '</div>';
    }

    function load() {
        var R = _renderer();
        if (!R || !R.renderPromotions) {
            _avisar('no se cargó js/renderer.js');
            return;
        }
        // No se auto-arranca en DOMContentLoaded a propósito: en ese momento
        // app.js todavía no terminó de traer PROMOTIONS.md, así que el render
        // saldría con el dato vacío y dejaría la tab en el fallback de
        // "no se pudo parsear". Para eso está la guarda: si todavía no hay
        // dato, no se dibuja nada y no se pisa nada.
        if (!window.__promoParsed) {
            return;
        }
        if (typeof fetch !== 'function') {
            // Sin fetch no hay rutas que validar: se dibuja igual y el render
            // lo aclara. Un panel ausente es peor que uno que avisa.
            R.renderPromotions(
                window.__promoParsed, window.__promoMd, null, 'sin fetch');
            return;
        }

        var url = (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.getRutasUrl)
            ? window.DASHBOARD_CONFIG.getRutasUrl() : null;

        if (!url) {
            R.renderPromotions(
                window.__promoParsed, window.__promoMd, null, 'sin getRutasUrl');
            return;
        }

        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                window.__rutasDev = data;
                R.renderPromotions(
                    window.__promoParsed, window.__promoMd, data, null);
            })
            .catch(function (err) {
                // La tab se dibuja igual. Lo que se pierde son los links
                // profundos, que es una molestia; lo que se evita es una tab
                // en blanco o un link que miente.
                try {
                    R.renderPromotions(
                        window.__promoParsed, window.__promoMd, null,
                        (err && err.message) || String(err));
                } catch (e2) {
                    // Si el render falló, reintentarlo con el mismo render no
                    // arregla nada: vuelve a fallar y el error se pierde en
                    // silencio, dejando la tab en blanco. Se escribe el
                    // motivo en el container para que se vea qué pasó.
                    _avisar((e2 && e2.message) || String(e2));
                }
            });
    }

    window.RutasDev = { load: load };
})();