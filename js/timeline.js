/**
 * js/timeline.js
 * Panel "Mientras no estabas" — Timeline de eventos.
 * Fuentes: SESSION_LOG.md + commits de GitHub API.
 * v2 — Fix parser SESSION_LOG, agrupación por día, traducciones, timestamps relativos.
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

        // 7) Agrupar por día
        const grouped = this._groupByDay(events);

        // 8) Renderizar con separadores de día
        let html = '';
        for (const [dayLabel, dayEvents] of grouped) {
            html += `<div class="timeline-day-separator"><span>${this._escape(dayLabel)}</span></div>`;
            html += dayEvents.map(e => this._eventHTML(e)).join('');
        }

        container.innerHTML = html;
    }

    /**
     * Parsea SESSION_LOG.md → array de eventos.
     * Formato: `## [YYYY-MM-DDTHH:MMZ] Título` (con ## opcional)
     */
    static _parseSessionLog(md) {
        if (!md || typeof md !== 'string') return [];

        const events = [];
        // Regex corregida: permite `## ` opcional antes de `[timestamp]`
        const headerRegex = /^#{1,3}\s*\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\]\s*(.+)$/gm;
        let match;

        while ((match = headerRegex.exec(md)) !== null) {
            const timestamp = new Date(match[1]).getTime();
            const title = match[2].trim().replace(/\r$/, '');

            if (isNaN(timestamp) || timestamp === 0) continue;

            const type = this._detectEventType(title);
            const agent = this._detectAgent(title);

            events.push({
                timestamp,
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
     */
    static _parseCommits(commits) {
        if (!Array.isArray(commits)) return [];

        return commits.map(c => {
            const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
            const timestamp = dateStr ? new Date(dateStr).getTime() : 0;
            const fullMessage = c.commit?.message || '';
            const firstLine = fullMessage.split('\n')[0].trim();

            const parsed = this._parseCommitMessage(firstLine);
            const agent = this._detectAgentFromCommit(firstLine);

            return {
                timestamp,
                type: parsed.type,
                agent,
                title: parsed.title,
                scope: parsed.scope,
                subtitle: '',
                source: 'commit',
                sha: (c.sha || '').substring(0, 7),
                author: c.commit?.author?.name || c.author?.login || 'Pablo'
            };
        }).filter(e => e.timestamp > 0);
    }

    /**
     * Parsea el mensaje del commit: separa tipo, scope y título.
     * Ejemplo: "feat(legendary-tracker): skeleton del módulo" →
     *   { type: 'feature', scope: 'legendary-tracker', title: 'skeleton del módulo' }
     */
    static _parseCommitMessage(message) {
        // Formato: "type(scope): title" o "type: title"
        const withScope = message.match(/^(\w+)(\(([^)]+)\))?:\s*(.+)$/);

        if (withScope) {
            const typeKey = withScope[1].toLowerCase();
            const scope = withScope[3] || '';
            const title = withScope[4].trim();

            return {
                type: this._mapCommitType(typeKey),
                scope,
                title
            };
        }

        // Formato sin prefijo (merge, revert, etc.)
        if (/^merge/i.test(message)) {
            return { type: 'merge', scope: '', title: message };
        }
        if (/^revert/i.test(message)) {
            return { type: 'revert', scope: '', title: message };
        }

        return { type: 'commit', scope: '', title: message };
    }

    /**
     * Mapea el tipo de commit a un tipo de evento interno.
     */
    static _mapCommitType(typeKey) {
        const map = {
            'feat': 'feature',
            'fix': 'fix',
            'docs': 'docs',
            'chore': 'chore',
            'refactor': 'refactor',
            'test': 'test',
            'style': 'style',
            'perf': 'perf',
            'ci': 'ci',
            'build': 'build'
        };
        return map[typeKey] || 'commit';
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
     * Detecta agente del título del log.
     */
    static _detectAgent(title) {
        if (/\bpo\b|product.owner/i.test(title)) return 'po';
        if (/heartbeat principal|principal/i.test(title)) return 'principal';
        if (/documentador|documenter/i.test(title)) return 'documenter';
        if (/reviewer|code.review/i.test(title)) return 'reviewer';
        if (/arquitecto|architect/i.test(title)) return 'architect';
        if (/admin/i.test(title)) return 'admin';
        if (/heartbeat #\d+/i.test(title)) return 'principal';
        return 'system';
    }

    /**
     * Detecta agente del mensaje de commit (por scope).
     */
    static _detectAgentFromCommit(message) {
        if (/\(legendary/i.test(message)) return 'principal';
        if (/\(comms/i.test(message)) return 'admin';
        if (/\(heartbeat/i.test(message)) return 'principal';
        if (/\(status/i.test(message)) return 'principal';
        if (/\(admin/i.test(message)) return 'admin';
        if (/\(po\b/i.test(message)) return 'po';
        if (/\(docs/i.test(message)) return 'documenter';
        if (/\(backlog/i.test(message)) return 'principal';
        if (/\(session/i.test(message)) return 'principal';
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
     * Agrupa los eventos por día.
     * Retorna un Map: { 'Hoy': [...], 'Ayer': [...], '27/09': [...] }
     */
    static _groupByDay(events) {
        const groups = new Map();
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

        events.forEach(e => {
            const d = new Date(e.timestamp);
            const dayKey = d.toDateString();
            let label;

            if (dayKey === today) {
                label = 'Hoy';
            } else if (dayKey === yesterday) {
                label = 'Ayer';
            } else {
                const dd = String(d.getDate()).padStart(2, '0');
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                label = `${dd}/${mo}`;
            }

            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(e);
        });

        return groups;
    }

    /**
     * Genera el HTML de un evento.
     */
    static _eventHTML(e) {
        const time = this._formatTime(e.timestamp);
        const relative = this._formatRelative(e.timestamp);
        const icon = this._iconForType(e.type);
        const typeLabel = this._typeLabel(e.type);
        const agentLabel = this._agentLabel(e.agent);

        // Subtítulo: SHA + Agente + tiempo relativo
        const subtitleParts = [];
        if (e.sha) subtitleParts.push(`SHA ${e.sha}`);
        if (agentLabel) subtitleParts.push(agentLabel);
        if (relative) subtitleParts.push(relative);

        const subtitle = subtitleParts.join(' · ');

        // Scope badge (para commits)
        const scopeBadge = e.scope
            ? `<span class="timeline-event__scope">${this._escape(e.scope)}</span>`
            : '';

        // Título: si es commit, mostrar title limpio; si es log, mostrar title completo
        const title = this._escape(e.title);

        return `
            <div class="timeline-event timeline-event--${e.type}">
                <div class="timeline-event__time">${time}</div>
                <div class="timeline-event__icon">${icon}</div>
                <div class="timeline-event__content">
                    <div class="timeline-event__header">
                        <span class="timeline-event__type">${typeLabel}</span>
                        ${scopeBadge}
                    </div>
                    <div class="timeline-event__title">${title}</div>
                    ${subtitle ? `<div class="timeline-event__subtitle">${this._escape(subtitle)}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Formatea el timestamp: HH:MM (hoy) o DD/MM HH:MM.
     */
    static _formatTime(ts) {
        if (!ts) return '--:--';
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    /**
     * Formatea tiempo relativo: "hace 5 min", "hace 2h", "hace 3d".
     */
    static _formatRelative(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `hace ${h}h`;
        const d = Math.floor(h / 24);
        return `hace ${d}d`;
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
            'style': '🎨',
            'perf': '⚡',
            'ci': '🔁',
            'build': '📦',
            'merge': '🔀',
            'revert': '↩️',
            'commit': '📦',
            'event': '•'
        };
        return map[type] || '•';
    }

    /**
     * Label en español del tipo de evento.
     */
    static _typeLabel(type) {
        const map = {
            'heartbeat': 'Heartbeat',
            'fix': 'Corrección',
            'deploy': 'Deploy',
            'error': 'Error',
            'feature': 'Nueva feature',
            'decision': 'Decisión',
            'docs': 'Documentación',
            'chore': 'Mantenimiento',
            'refactor': 'Refactor',
            'test': 'Test',
            'style': 'Estilo',
            'perf': 'Rendimiento',
            'ci': 'CI/CD',
            'build': 'Build',
            'merge': 'Merge',
            'revert': 'Revert',
            'commit': 'Commit',
            'event': 'Evento'
        };
        return map[type] || 'Evento';
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
    document.querySelectorAll('.timeline-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
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
