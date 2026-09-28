/**
 * js/timeline.js
 * Panel "Mientras no estabas" — Timeline de eventos.
 * Fuentes: SESSION_LOG.md + commits de GitHub API.
 * v3 — Filtro por categoría + dropdown dinámico.
 */

class DashboardTimeline {

    static render(sessionLogContent, commits, options = {}) {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        const range = options.range || '8h';
        const agentFilter = options.agentFilter || 'all';
        const categoryFilter = options.categoryFilter || 'all';

        const logEvents = this._parseSessionLog(sessionLogContent);
        const commitEvents = this._parseCommits(commits);

        let events = [...logEvents, ...commitEvents];
        events.sort((a, b) => b.timestamp - a.timestamp);

        const rangeMs = this._rangeToMs(range);
        const cutoff = Date.now() - rangeMs;
        events = events.filter(e => e.timestamp >= cutoff);

        // Poblar dropdown de categorías (solo con las presentes en el rango actual)
        this._populateCategoryFilter(events);

        // Aplicar filtro de agente
        if (agentFilter !== 'all') {
            events = events.filter(e => e.agent === agentFilter);
        }

        // Aplicar filtro de categoría
        if (categoryFilter !== 'all') {
            events = events.filter(e => e.type === categoryFilter);
        }

        if (events.length === 0) {
            container.innerHTML = `<p class="loading">Sin eventos con los filtros aplicados.</p>`;
            return;
        }

        // Actualizar el hint de categoría (texto a la derecha del dropdown)
        this._updateCategoryHint(categoryFilter);

        const grouped = this._groupByDay(events);
        let html = '';
        for (const [dayLabel, dayEvents] of grouped) {
            html += `<div class="timeline-day-separator"><span>${this._escape(dayLabel)}</span></div>`;
            html += dayEvents.map(e => this._eventHTML(e)).join('');
        }

        container.innerHTML = html;
    }

    /**
     * Puebla el dropdown de categorías con las que existen en los eventos.
     * Mantiene la selección actual si sigue siendo válida.
     */
    static _populateCategoryFilter(events) {
        const select = document.getElementById('timeline-category-filter');
        if (!select) return;

        // Contar eventos por categoría
        const counts = {};
        events.forEach(e => {
            counts[e.type] = (counts[e.type] || 0) + 1;
        });

        // Ordenar por cantidad descendente
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        // Guardar valor actual
        const currentValue = select.value || 'all';

        // Reconstruir opciones
        let html = `<option value="all">Todas las categorías (${events.length})</option>`;
        sorted.forEach(([type, count]) => {
            const label = this._typeLabel(type);
            html += `<option value="${type}">${label} (${count})</option>`;
        });

        select.innerHTML = html;

        // Sincronizar state con el dropdown.
        // Prioridad: state actual → sino 'all'.
        const stateValue = (window.timelineState && window.timelineState.categoryFilter) || 'all';
        if (stateValue !== 'all' && counts[stateValue]) {
            select.value = stateValue;
        } else {
            select.value = 'all';
            if (window.timelineState) window.timelineState.categoryFilter = 'all';
        }
    }

    /**
     * Actualiza el texto hint a la derecha del dropdown de categoría.
     * Muestra una descripción coloquial de qué tipo de registros se están viendo.
     */
    static _updateCategoryHint(categoryFilter) {
        const hint = document.getElementById('timeline-category-hint');
        if (!hint) return;

        const map = {
            'all': 'Mostrando todos los registros del período',
            'feature': 'Commits que agregaron funcionalidad nueva',
            'fix': 'Commits que arreglaron bugs o errores',
            'docs': 'Commits que actualizaron documentación',
            'chore': 'Commits de mantenimiento: ajustes internos sin cambios visibles',
            'refactor': 'Commits que reorganizaron código sin cambiar funcionalidad',
            'test': 'Commits que agregaron o modificaron tests',
            'style': 'Commits de formato: estilos sin cambio de comportamiento',
            'perf': 'Commits que mejoraron el rendimiento',
            'ci': 'Commits relacionados con CI/CD (integración continua)',
            'build': 'Commits relacionados con el build del proyecto',
            'merge': 'Uniones de ramas de trabajo',
            'revert': 'Reversiones de cambios anteriores',
            'commit': 'Commits sin categoría específica',
            'heartbeat': 'Registros automáticos del equipo (revisión periódica)',
            'deploy': 'Subidas de código al servidor',
            'error': 'Registros de errores y timeouts',
            'decision': 'Decisiones importantes del equipo',
            'event': 'Eventos generales del ecosistema'
        };

        hint.textContent = map[categoryFilter] || '';
    }

    static _parseSessionLog(md) {
        if (!md || typeof md !== 'string') return [];

        const events = [];
        const headerRegex = /^#{1,3}\s*\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\]\s*(.+)$/gm;
        let match;

        while ((match = headerRegex.exec(md)) !== null) {
            const timestamp = new Date(match[1]).getTime();
            const title = match[2].trim().replace(/\r$/, '');
            if (isNaN(timestamp) || timestamp === 0) continue;

            events.push({
                timestamp,
                type: this._detectEventType(title),
                agent: this._detectAgent(title),
                title,
                subtitle: '',
                source: 'log'
            });
        }

        return events;
    }

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

    static _parseCommitMessage(message) {
        const withScope = message.match(/^(\w+)(\(([^)]+)\))?:\s*(.+)$/);
        if (withScope) {
            return {
                type: this._mapCommitType(withScope[1].toLowerCase()),
                scope: withScope[3] || '',
                title: withScope[4].trim()
            };
        }
        if (/^merge/i.test(message)) return { type: 'merge', scope: '', title: message };
        if (/^revert/i.test(message)) return { type: 'revert', scope: '', title: message };
        return { type: 'commit', scope: '', title: message };
    }

    static _mapCommitType(typeKey) {
        const map = {
            'feat': 'feature', 'fix': 'fix', 'docs': 'docs', 'chore': 'chore',
            'refactor': 'refactor', 'test': 'test', 'style': 'style',
            'perf': 'perf', 'ci': 'ci', 'build': 'build'
        };
        return map[typeKey] || 'commit';
    }

    static _detectEventType(title) {
        if (/heartbeat/i.test(title)) return 'heartbeat';
        if (/fix|bug/i.test(title)) return 'fix';
        if (/deploy|push|commit/i.test(title)) return 'deploy';
        if (/timeout|fail|error/i.test(title)) return 'error';
        if (/phase|skeleton|implement/i.test(title)) return 'feature';
        if (/decision|aprob/i.test(title)) return 'decision';
        return 'event';
    }

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

    static _rangeToMs(range) {
        const map = {
            '1h': 60 * 60 * 1000,
            '8h': 8 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        return map[range] || map['8h'];
    }

    static _groupByDay(events) {
        const groups = new Map();
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

        events.forEach(e => {
            const d = new Date(e.timestamp);
            const dayKey = d.toDateString();
            let label;

            if (dayKey === today) label = 'Hoy';
            else if (dayKey === yesterday) label = 'Ayer';
            else {
                const dd = String(d.getDate()).padStart(2, '0');
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                label = `${dd}/${mo}`;
            }

            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(e);
        });

        return groups;
    }

    static _eventHTML(e) {
        const time = this._formatTime(e.timestamp);
        const relative = this._formatRelative(e.timestamp);
        const icon = this._iconForType(e.type);
        const typeLabel = this._typeLabel(e.type);
        const agentLabel = this._agentLabel(e.agent);

        const subtitleParts = [];
        if (e.sha) subtitleParts.push(`SHA ${e.sha}`);
        if (agentLabel) subtitleParts.push(agentLabel);
        if (relative) subtitleParts.push(relative);
        const subtitle = subtitleParts.join(' · ');

        const scopeBadge = e.scope
            ? `<span class="timeline-event__scope">${this._escape(e.scope)}</span>`
            : '';

        return `
            <div class="timeline-event timeline-event--${e.type}">
                <div class="timeline-event__time">${time}</div>
                <div class="timeline-event__icon">${icon}</div>
                <div class="timeline-event__content">
                    <div class="timeline-event__header">
                        <span class="timeline-event__type">${typeLabel}</span>
                        ${scopeBadge}
                    </div>
                    <div class="timeline-event__title">${this._escape(e.title)}</div>
                    ${subtitle ? `<div class="timeline-event__subtitle">${this._escape(subtitle)}</div>` : ''}
                </div>
            </div>
        `;
    }

    static _formatTime(ts) {
        if (!ts) return '--:--';
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

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

    static _iconForType(type) {
        const map = {
            'heartbeat': '💓', 'fix': '🔧', 'deploy': '🚀', 'error': '⚠️',
            'feature': '✨', 'decision': '📌', 'docs': '📝', 'chore': '🧹',
            'refactor': '♻️', 'test': '🧪', 'style': '🎨', 'perf': '⚡',
            'ci': '🔁', 'build': '📦', 'merge': '🔀', 'revert': '↩️',
            'commit': '📦', 'event': '•'
        };
        return map[type] || '•';
    }

    static _typeLabel(type) {
        const map = {
            'heartbeat': 'Heartbeat', 'fix': 'Corrección', 'deploy': 'Deploy',
            'error': 'Error', 'feature': 'Nueva feature', 'decision': 'Decisión',
            'docs': 'Documentación', 'chore': 'Mantenimiento', 'refactor': 'Refactor',
            'test': 'Test', 'style': 'Estilo', 'perf': 'Rendimiento',
            'ci': 'CI/CD', 'build': 'Build', 'merge': 'Merge',
            'revert': 'Revert', 'commit': 'Commit', 'event': 'Evento'
        };
        return map[type] || 'Evento';
    }

    static _agentLabel(agent) {
        const map = {
            'principal': 'Principal', 'po': 'PO', 'documenter': 'Documentador',
            'reviewer': 'Code Reviewer', 'architect': 'Arquitecto',
            'admin': 'Admin', 'system': ''
        };
        return map[agent] || '';
    }

    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }
}

// Estado global del timeline
window.timelineState = { range: '8h', agentFilter: 'all', categoryFilter: 'all' };

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

// Handler global para cambio de filtro de categoría
window.setTimelineCategory = function(category) {
    window.timelineState.categoryFilter = category;
    if (window._timelineData) {
        DashboardTimeline.render(
            window._timelineData.sessionLog,
            window._timelineData.commits,
            window.timelineState
        );
    }
};
