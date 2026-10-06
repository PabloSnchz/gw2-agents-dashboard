/**
 * js/prebacklog.js — Tab [P] Pre-backlog.
 *
 * Lee PRE_BACKLOG.md de agents/main y renderiza cada idea como card con sus
 * dos botones: "Mover a backlog" y "Descartar". Las acciones no se ejecutan
 * acá: el dashboard es solo vista. Los botones copian el comando al canal
 * durable para que el PO lo reciba en su próximo heartbeat.
 *
 * 2026-10-05. Sin este módulo la tab quedaba vacía: el container
 * #prebacklog-container existía en index.html pero nada lo llenaba. El
 * mismo fallo que desarrollo, backlog y las tres tabs nuevas.
 */
(function () {
    const CONTAINER_ID = 'prebacklog-container';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function card(idea) {
        const id = esc(idea.id || '?');
        const titulo = esc(idea.titulo || idea.título || 'Sin título');
        const fuente = esc(idea.fuente || '');
        const estado = esc(idea.estado || 'pendiente');
        const attrs = [
            ['Origen', fuente],
            ['Estado', estado]
        ];
        const attrsHtml = attrs.filter(a => a[1]).map(a =>
            '<span class="pb-attr"><strong>' + a[0] + ':</strong> ' + a[1] + '</span>'
        ).join('');
        const obs = idea.observaciones || idea.obs;
        const obsHtml = obs
            ? '<div class="pb-obs">' + esc(obs) + '</div>'
            : '';
        return '<article class="pb-card" data-id="' + id + '">'
            + '<div class="pb-head"><span class="pb-id">' + id + '</span>'
            + '<span class="pb-estado pb-estado--' + estado.replace(/[^a-z0-9]/g, '-') + '">' + estado + '</span></div>'
            + '<h4 class="pb-title">' + titulo + '</h4>'
            + '<div class="pb-attrs">' + attrsHtml + '</div>'
            + obsHtml
            + '<div class="pb-actions">'
            + '<button class="btn btn-primary btn-sm" onclick="prebacklogMover('' + id + '')">Mover a backlog</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="prebacklogDescartar('' + id + '')">Descartar</button>'
            + '</div></article>';
    }

    function empty(msg) {
        return '<div class="pb-empty"><p>' + esc(msg) + '</p></div>';
    }

    window.Prebacklog = {
        load: function () {
            const c = document.getElementById(CONTAINER_ID);
            if (!c) return;
            const ideas = window.__prebacklogIdeas || [];
            if (!ideas.length) {
                c.innerHTML = empty('No hay ideas en el pre-backlog. PRE_BACKLOG.md está vacío o no se pudo leer.');
                return;
            }
            c.innerHTML = ideas.map(card).join('');
        }
    };

    window.prebacklogMover = function (id) {
        const cmd = 'Mover a backlog: ' + id;
        if (window.CommsChannel && window.CommsChannel.send) {
            window.CommsChannel.send({ to: 'product-owner', text: cmd, tag: 'prebacklog' });
        }
        window.showStatus ? window.showStatus('Comando encolado: ' + cmd, 'status-ok') : null;
    };

    window.prebacklogDescartar = function (id) {
        const cmd = 'Descartar del pre-backlog: ' + id;
        if (window.CommsChannel && window.CommsChannel.send) {
            window.CommsChannel.send({ to: 'product-owner', text: cmd, tag: 'prebacklog' });
        }
        window.showStatus ? window.showStatus('Comando encolado: ' + cmd, 'status-warning') : null;
    };
})();
