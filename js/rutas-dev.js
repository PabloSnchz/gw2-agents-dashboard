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
                return cargarFeatures(R, data, null);
            })
            .catch(function (err) {
                // La tab se dibuja igual. Lo que se pierde son los links
                // profundos, que es una molestia; lo que se evita es una tab
                // en blanco o un link que miente.
                try {
                    R.renderPromotions(
                        window.__promoParsed, window.__promoMd, null,
                        (err && err.message) || String(err), null, null, null, null);
                } catch (e2) {
                    // Si el render falló, reintentarlo con el mismo render no
                    // arregla nada: vuelve a fallar y el error se pierde en
                    // silencio, dejando la tab en blanco. Se escribe el
                    // motivo en el container para que se vea qué pasó.
                    _avisar((e2 && e2.message) || String(e2));
                }
            });
    }

    /**
     * FEATURES.md: el catálogo de lo que el equipo construyó, escrito por el
     * Principal al mergear a agents/main.
     *
     * Va PRIMERO en la cadena, antes que dev-catalogo.json, y no en paralelo,
     * por dos razones que_importan:
     *
     *  1. Sin fichas la tab no tiene nada que mostrar. El catálogo de rutas
     *     sirve para VALIDAR los links; sin la ficha no hay a qué validarlos.
     *  2. El orden de los .then marca el orden de la espera. Si las dos cosas
     *     se piden juntas y una falla, el catch se dispara antes de que la
     *     otra llegue, y la tab se dibuja con medio dato. Encadenadas, cada
     *     error se reporta en el campo que le corresponde.
     */
    function cargarFeatures(R, rutas, errRutas) {
        var cfg = window.DASHBOARD_CONFIG;
        var url = cfg && cfg.getFeaturesUrl ? cfg.getFeaturesUrl() : null;
        if (!url) {
            R.renderPromotions(window.__promoParsed, window.__promoMd, rutas,
                errRutas, null, null, null, 'sin getFeaturesUrl');
            return;
        }
        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (txt) {
                window.__featuresMd = txt;
                var fichas = [];
                if (window.DevCatalogo && window.DevCatalogo.parseFeatures) {
                    fichas = window.DevCatalogo.parseFeatures(txt);
                }
                window.__features = fichas;
                cargarCatalogo(R, rutas, errRutas, fichas, null);
            })
            .catch(function (err) {
                // Un 404 acá significa que el equipo todavia no escribio
                // FEATURES.md. NO es lo mismo que "no hay features": por eso
                // el error viaja como fichasError y no como fichas vacias,
                // para que la tab pueda decirlo al pie.
                cargarCatalogo(R, rutas, errRutas, null,
                    (err && err.message) || String(err));
            });
    }

    /**
     * data/dev-catalogo.json responde "qué pantallas REALES tiene dev": las
     * lee _eco\gen_dev_catalogo.py del js/ de gw2-dev. Sirve solo para
     * verificar los links de las fichas — si una ruta declarada no existe acá,
     * la ficha se muestra sin link en vez de mandar a una pantalla inventada.
     */
    function cargarCatalogo(R, rutas, errRutas, fichas, fichasError) {
        var cfg = window.DASHBOARD_CONFIG;
        var url = cfg && cfg.getCatalogoUrl ? cfg.getCatalogoUrl() : null;
        if (!url) {
            R.renderPromotions(window.__promoParsed, window.__promoMd, rutas,
                errRutas, null, 'sin getCatalogoUrl', fichas, fichasError);
            return;
        }
        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                window.__devCatalogo = data;
                R.renderPromotions(window.__promoParsed, window.__promoMd, rutas,
                    errRutas, data, null, fichas, fichasError);
            })
            .catch(function (err) {
                // Sin catálogo se pierden los links profundos, pero las fichas
                // siguen siendo legibles. Se dibuja igual y el botón pasa a
                // "ruta no verificada" en vez de desaparecer.
                R.renderPromotions(window.__promoParsed, window.__promoMd, rutas,
                    errRutas, null, (err && err.message) || String(err),
                    fichas, fichasError);
            });
    }

    window.RutasDev = { load: load };
})();