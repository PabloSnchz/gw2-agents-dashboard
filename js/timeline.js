/**
 * js/timeline.js
 * Panel "Mientras no estabas" — Timeline de eventos.
 * Fuentes: SESSION_LOG.md + commits de GitHub API.
 */

class DashboardTimeline {

    /**
     * Renderiza el timeline completo.
     * @param {string} sessionLogContent - contenido raw de SESSION_LOG.md
     * @param {Array} commits - array de commits de GitHub API (o [])
     * @param {Object} options - { range: '1h' | '8h' | '24h' | '7d', agentFilter: 'all' | '<name>' }
     */
    static render(sessionLogContent, commits, options = {}) {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        const range = options.range || '8h';
        const agentFilter = options.agentFilter || 'all';

        // 1) Parsear eventos del SESSION_LOG
        const logEvents = this._parseSessionLog(sessionLogContent);

        // 2) Parsear eventos de commits
        const commitEvents = this._parseCommits(commits);

        // 3) Combinar + ordenar (descendente por timestamp)
        let events = [...logEvents, ...commitEvents];
        events.sort((a, b) => b.timestamp - a.timestamp);

        // 4) Filtrar por rango temporal
        const rangeMs = this._rangeToMs(range);
        const cutoff = Date.now() - rangeMs;
        events = events.filter(e => e.timestamp >= cutoff);

        // 5) Filtrar por agente
        if (agentFilter !== 'all') {
            events = events.filter(e => e.agent === agentFilter);
        }

        // 6) Renderizar
        if (events.length === 0) {
            container.innerHTML = `<p class="loading">Sin eventos en el rango seleccionado.</p>`;
            return;
        }

        container.innerHTML = events.map(e => this._eventHTML(e)).join('');
    }

    /**
     * Parsea SESSION_LOG.md → array de eventos.
     * Formato esperado: `[YYYY-MM-DDTHH:MMZ] Título` + contenido debajo.
     */
    static _parseSessionLog(md) {
        if (!md || typeof md !== 'string') return [];

        const events = [];
        // Buscar todos los headers con formato [timestamp]
        const headerRegex = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\]\s*(.+)$/gm;
        let match;

        while ((match = headerRegex.exec(md)) !== null) {
            const timestamp = new Date(match[1]).getTime();
            const title = match[2].trim();

            // Detectar tipo por emoji en el título o por texto
            const type = this._detectEventType(title);

            // Detectar agente por texto del título
            const agent = this._detectAgent(title);

            events.push({
                timestamp: isNaN(timestamp) ? 0 : timestamp,
                type,
                agent,
                title,
                subtitle: '',
                source: 'log'
            });
        }

        return events;
    }

    /**
     * Parsea commits de GitHub API → array de eventos.
     * Formato: { commit: { author: { date }, message }, author: { login } }
     */
    static _parseCommits(commits) {
        if (!Array.isArray(commits)) return [];

        return commits.map(c => {
            const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
            const timestamp = dateStr ? new Date(dateStr).getTime() : 0;
            const message = (c.commit?.message || '').split('\n')[0]; // primera línea

            const type = this._detectCommitType(message);
            const agent = this._detectAgentFromCommit(message);

            return {
                timestamp,
                type,
                agent,
                title: message,
                subtitle: `Commit ${c.sha?.substring(0, 7) || ''}`,
                source: 'commit',
                sha: c.sha
            };
        }).filter(e => e.timestamp > 0);
    }

    /**
     * Detecta tipo de evento del título del log.
     */
    static _detectEventType(title) {
        if (/heartbeat/i.test(title)) return 'heartbeat';
        if (/fix|bug/i.test(title)) return 'fix';
        if (/deploy|push|commit/i.test(title)) return 'deploy';
        if (/timeout|fail|error/i.test(title)) return 'error';
        if (/phase|skeleton|implement/i.test(title)) return 'feature';
        if (/decision|aprob/i.test(title)) return 'decision';
        return 'event';
    }

    /**
     * Detecta tipo de evento del mensaje del commit.
     */
    static _detectCommitType(message) {
        if (/^fix/i.test(message)) return 'fix';
        if (/^feat/i.test(message)) return 'feature';
        if (/^docs/i.test(message)) return 'docs';
        if (/^chore/i.test(message)) return 'chore';
        if (/^refactor/i.test(message)) return 'refactor';
        if (/^test/i.test(message)) return 'test';
        return 'commit';
    }

    /**
     * Detecta agente del título.
     */
    static _detectAgent(title) {
        if (/po\b|product.owner/i.test(title)) return 'po';
        if (/principal|dev chat|heartbeat principal/i.test(title)) return 'principal';
        if (/documentador|documenter/i.test(title)) return 'documenter';
        if (/reviewer|code.review/i.test(title)) return 'reviewer';
        if (/arquitecto|architect/i.test(title)) return 'architect';
        if (/admin/i.test(title)) return 'admin';
        return 'system';
    }

    /**
     * Detecta agente del mensaje de commit.
     * Limitación: la API de GitHub no expone el "agente" — solo el autor humano (Pablo).
     * Este método intenta inferir del scope del mensaje.
     */
    static _detectAgentFromCommit(message) {
        if (/\(legendary/i.test(message)) return 'principal';
        if (/\(comms/i.test(message)) return 'admin';
        if (/\(heartbeat/i.test(message)) return 'principal';
        if (/\(status/i.test(message)) return 'principal';
        if (/\(po/i.test(message)) return 'po';
        if (/\(docs/i.test(message)) return 'documenter';
        return 'system';
    }

    /**
     * Convierte el rango ('1h', '8h', '24h', '7d') a milisegundos.
     */
    static _rangeToMs(range) {
        const map = {
            '1h': 60 * 60 * 1000,
            '8h': 8 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        return map[range] || map['8h'];
    }

    /**
     * Genera el HTML de un evento.
     */
    static _eventHTML(e) {
        const time = this._formatTime(e.timestamp);
        const icon = this._iconForType(e.type);
        const agentLabel = this._agentLabel(e.agent);

        return `
            <div class="timeline-event timeline-event--${e.type}">
                <div class="timeline-event__time">${time}</div>
                <div class="timeline-event__icon">${icon}</div>
                <div class="timeline-event__content">
                    <div class="timeline-event__title">${this._escape(e.title)}</div>
                    ${e.subtitle ? `<div class="timeline-event__subtitle">${this._escape(e.subtitle)}</div>` : ''}
                    ${agentLabel ? `<div class="timeline-event__agent">${agentLabel}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Formatea el timestamp a HH:MM o DD/MM HH:MM si es de otro día.
     */
    static _formatTime(ts) {
        if (!ts) return '--:--';
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();

        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');

        if (sameDay) return `${hh}:${mm}`;

        const dd = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mo} ${hh}:${mm}`;
    }

    /**
     * Icono por tipo de evento.
     */
    static _iconForType(type) {
        const map = {
            'heartbeat': '💓',
            'fix': '🔧',
            'deploy': '🚀',
            'error': '⚠️',
            'feature': '✨',
            'decision': '📌',
            'docs': '📝',
            'chore': '🧹',
            'refactor': '♻️',
            'test': '🧪',
            'commit': '📦',
            'event': '•'
        };
        return map[type] || '•';
    }

    /**
     * Label legible del agente.
     */
    static _agentLabel(agent) {
        const map = {
            'principal': 'Principal',
            'po': 'PO',
            'documenter': 'Documentador',
            'reviewer': 'Code Reviewer',
            'architect': 'Arquitecto',
            'admin': 'Admin',
            'system': ''
        };
        return map[agent] || '';
    }

    /**
     * Escape HTML básico.
     */
    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }
}

// Estado global del timeline (para filtros)
window.timelineState = { range: '8h', agentFilter: 'all' };

// Handler global para cambio de rango
window.setTimelineRange = function(range) {
    window.timelineState.range = range;
    // Actualizar botones activos
    document.querySelectorAll('.timeline-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
    // Re-render
    if (window._timelineData) {
        DashboardTimeline.render(
            window._timelineData.sessionLog,
            window._timelineData.commits,
            window.timelineState
        );
    }
};

// Handler global para cambio de filtro de agente
window.setTimelineAgent = function(agent) {
    window.timelineState.agentFilter = agent;
    if (window._timelineData) {
        DashboardTimeline.render(
            window._timelineData.sessionLog,
            window._timelineData.commits,
            window.timelineState
        );
    }
};
