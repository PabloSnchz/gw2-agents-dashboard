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

    function load() {
        if (!window.DashboardRenderer || !window.DashboardRenderer.renderPromotions) {
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
            window.DashboardRenderer.renderPromotions(
                window.__promoParsed, window.__promoMd, null, 'sin fetch');
            return;
        }

        var url = (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.getRutasUrl)
            ? window.DASHBOARD_CONFIG.getRutasUrl() : null;

        if (!url) {
            window.DashboardRenderer.renderPromotions(
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
                window.DashboardRenderer.renderPromotions(
                    window.__promoParsed, window.__promoMd, data, null);
            })
            .catch(function (err) {
                // La tab se dibuja igual. Lo que se pierde son los links
                // profundos, que es una molestia; lo que se evita es una tab
                // en blanco o un link que miente.
                window.DashboardRenderer.renderPromotions(
                    window.__promoParsed, window.__promoMd, null,
                    (err && err.message) || String(err));
            });
    }

    window.RutasDev = { load: load };
})();