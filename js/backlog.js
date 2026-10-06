/**
 * js/backlog.js — Tab [B] Backlog.
 *
 * Lee BACKLOG.md de agents/main y renderiza cada tarea priorizada como card
 * con tres botones: Iniciar, Pausar, Revisar. Igual que prebacklog.js: vista
 * solamente, los botones encolan comandos al canal durable.
 *
 * 2026-10-05. La tab existía en index.html (#backlog-container) pero ningún
 * script la llenaba. Mismo diagnóstico que las otras dos tabs nuevas.
 */
(function () {
    const CONTAINER_ID = 'backlog-container';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function card(tarea) {
        const id = esc(tarea.id || '?');
        const titulo = esc(tarea.titulo || tarea.título || 'Sin título');
        const prioridad = esc(tarea.prioridad || '');
        const estado = esc(tarea.estado || 'pendiente');
        const attrs = [];
        if (prioridad) attrs.push(['Prioridad', prioridad]);
        attrs.push(['Estado', estado]);
        const attrsHtml = attrs.map(a =>
            '<span class="bl-attr"><strong>' + a[0] + ':</strong> ' + a[1] + '</span>'
        ).join('');
        const obs = tarea.observaciones || tarea.obs;
        const obsHtml = obs ? '<div class="bl-obs">' + esc(obs) + '</div>' : '';
        return '<article class="bl-card" data-id="' + id + '">'
            + '<div class="bl-head"><span class="bl-id">' + id + '</span>'
            + '<span class="bl-estado bl-estado--' + estado.replace(/[^a-z0-9]/g, '-') + '">' + estado + '</span></div>'
            + '<h4 class="bl-title">' + titulo + '</h4>'
            + '<div class="bl-attrs">' + attrsHtml + '</div>'
            + obsHtml
            + '<div class="bl-actions">'
            + '<button class="btn btn-primary btn-sm" onclick="backlogIniciar('' + id + '')">Iniciar</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="backlogPausar('' + id + '')">Pausar</button>'
            + '<button class="btn btn-ghost btn-sm" onclick="backlogRevisar('' + id + '')">Revisar</button>'
            + '</div></article>';
    }

    function empty(msg) {
        return '<div class="bl-empty"><p>' + esc(msg) + '</p></div>';
    }

    window.Backlog = {
        load: function () {
            const c = document.getElementById(CONTAINER_ID);
            if (!c) return;
            const tareas = window.__backlogTareas || [];
            if (!tareas.length) {
                c.innerHTML = empty('El backlog está vacío. BACKLOG.md no se pudo leer o no tiene tareas.');
                return;
            }
            c.innerHTML = tareas.map(card).join('');
        }
    };

    function enqueue(text, tag) {
        const msg = { to: 'default', text: text, tag: tag };
        if (window.CommsChannel && window.CommsChannel.send) {
            window.CommsChannel.send(msg);
        }
        if (window.showStatus) window.showStatus('Comando encolado: ' + text, 'status-ok');
    }

    window.backlogIniciar = function (id) { enqueue('Iniciar tarea backlog: ' + id, 'backlog'); };
    window.backlogPausar = function (id) { enqueue('Pausar tarea backlog: ' + id, 'backlog'); };
    window.backlogRevisar = function (id) { enqueue('Revisar tarea backlog: ' + id, 'backlog'); };
})();
