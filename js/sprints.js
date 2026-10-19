/**
 * js/sprints.js — Tab [🏃] Sprints.
 *
 * Lee data/sprint.json y renderiza las historias activas por sprint,
 * con su estado, responsable y tarea asociada. Vista de solo lectura:
 * el Arquitecto (vos) es quien asigna; el dashboard solo muestra.
 *
 * 2026-10-18. Creado porque el sprint no existía como concepto en el
 * dashboard: las historias se veían dispersas en Backlog, Desarrollo
 * y Promociones, y nowhere decía "esto es el sprint actual".
 */
(function () {
    const CONTAINER_ID = 'sprints-container';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function sprintCard(s) {
        const sprint = esc(s.sprint || '?');
        const periodo = esc(s.periodo || '');
        const historias = s.historias || [];
        const completadas = historias.filter(h => h.estado === 'completado').length;
        const total = historias.length;
        const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;

        const historiaCards = historias.map(h => {
            const id = esc(h.id || '?');
            const nombre = esc(h.nombre);
            const dificultad = esc(h.dificultad || '');
            const responsable = esc(h.responsable || '');
            const estado = esc(h.estado || 'asignado');
            const tareaId = h.tarea_id ? ' <span class="sp-task-id">task:' + esc(h.tarea_id) + '</span>' : '';
            const estadoClass = 'sp-estado--' + estado.replace(/[^a-z0-9]/g, '-');

            const description = h.description || h.desc || '';
            const descHtml = description
                ? '<p class="sp-h-desc">' + esc(description) + '</p>'
                : '';

            return '<article class="sp-historia-card">'
                + '<div class="sp-h-head"><span class="sp-h-id">' + id + '</span>'
                + '<span class="sp-estado ' + estadoClass + '">' + estado + '</span>'
                + '</div>'
                + '<h4 class="sp-h-title">' + nombre + '</h4>'
                + descHtml
                + '<div class="sp-h-meta">'
                + (dificultad ? '<span class="sp-h-diff">⏱ ' + dificultad + '</span>' : '')
                + (responsable ? '<span class="sp-h-resp">👤 ' + responsable + '</span>' : '')
                + tareaId
                + '</div>'
                + '</article>';
        }).join('');

        const bloqueados = (s.bloqueados_pablo || []).map(b =>
            '<li class="sp-bloqueado">🔒 ' + esc(b) + '</li>'
        ).join('');

        const bloqueadosSection = bloqueados
            ? '<div class="sp-bloqueados-section"><h3>Bloqueados (decisión de Pablo)</h3><ul>' + bloqueados + '</ul></div>'
            : '';

        const proximo = s.proximo_sprint
            ? '<div class="sp-proximo"><strong>Próximo sprint:</strong> ' + esc(s.proximo_sprint) + '</div>'
            : '';

        return '<section class="sp-sprint-card">'
            + '<div class="sp-sprint-head">'
            + '<h3>Sprint ' + sprint + '</h3>'
            + '<span class="sp-periodo">' + periodo + '</span>'
            + '</div>'
            + '<div class="sp-progress-bar"><div class="sp-progress-fill" style="width:' + progreso + '%"></div></div>'
            + '<span class="sp-progress-text">' + completadas + '/' + total + ' historias (' + progreso + '%)</span>'
            + '<div class="sp-historias">' + historiaCards + '</div>'
            + bloqueadosSection
            + proximo
            + '</section>';
    }

    function empty(msg) {
        return '<div class="sp-empty"><p>' + esc(msg) + '</p></div>';
    }

    function render(sprints) {
        const c = document.getElementById(CONTAINER_ID);
        if (!c) return;

        if (!sprints || !sprints.length) {
            c.innerHTML = empty('No hay sprints configurados. data/sprint.json está vacío.');
            return;
        }

        // Mostrar el sprint más reciente primero
        const ordenados = sprints.slice().sort((a, b) => {
            const na = parseInt(a.sprint) || 0;
            const nb = parseInt(b.sprint) || 0;
            return nb - na;
        });

        c.innerHTML = ordenados.map(sprintCard).join('');
    }

    window.Sprints = {
        load: function () {
            const data = window.__sprintData || [];
            render(data);
        }
    };
})();