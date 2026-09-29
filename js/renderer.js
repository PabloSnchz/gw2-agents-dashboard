/**
 * js/renderer.js
 * Renderiza componentes visuales del dashboard:
 * KPIs, agent cards, alertas/comms badges, y acordeones.
 */

class DashboardRenderer {

    /**
     * Renderiza las 4 KPI cards en grid 2×2
     * @param {Object} data — { agents, alerts, comms, sessions } parsed data
     */
    static renderKPIs(data) {
        const container = document.getElementById('kpi-grid');
        if (!container) return;

        const agentCount = data.agents ? data.agents.length : 0;
        const running = data.agents ? data.agents.filter(a => a.status === 'ok' || a.status === 'running').length : 0;
        const issues = agentCount - running;

        const alertActive = data.alerts ? data.alerts.active : 0;
        const alertCritical = data.alerts ? data.alerts.bySeverity.critical : 0;

        const commsPending = data.comms ? data.comms.pending : 0;
        const commsTimeout = data.comms ? data.comms.timeout : 0;

        const sessions = data.sessions ? data.sessions.sessionCount : 0;

        container.innerHTML = `
            <div class="kpi-card kpi-agents">
                <div class="kpi-header">
                    <span class="kpi-icon">🐈</span>
                    <span class="kpi-title">Agentes</span>
                </div>
                <div class="kpi-value">${running}/${agentCount}</div>
                <div class="kpi-sub">${issues} con issues</div>
            </div>
            <div class="kpi-card kpi-alerts">
                <div class="kpi-header">
                    <span class="kpi-icon">⚠️</span>
                    <span class="kpi-title">Alertas</span>
                </div>
                <div class="kpi-value">${alertActive}</div>
                <div class="kpi-sub">${alertCritical} críticas</div>
            </div>
            <div class="kpi-card kpi-comms">
                <div class="kpi-header">
                    <span class="kpi-icon">💬</span>
                    <span class="kpi-title">Comms</span>
                </div>
                <div class="kpi-value">${commsPending}</div>
                <div class="kpi-sub">${commsTimeout} timeouts</div>
            </div>
            <div class="kpi-card kpi-logs">
                <div class="kpi-header">
                    <span class="kpi-icon">📋</span>
                    <span class="kpi-title">Logs</span>
                </div>
                <div class="kpi-value">${sessions}</div>
                <div class="kpi-sub">sesiones</div>
            </div>
        `;
    }

    /**
     * Renderiza las cards de agentes (5 agentes con status color)
     * @param {Array} agents — [{ name, desc, status, raw }]
     */
    static renderAgentCards(agents) {
        const container = document.getElementById('agent-cards');
        if (!container) return;

        if (!agents || agents.length === 0) {
            container.innerHTML = '<p class="loading">No se pudieron extraer estados de agentes.</p>';
            return;
        }

        container.innerHTML = agents.map(agent => {
            const statusClass = this._agentStatusClass(agent.status);
            const statusIcon = this._agentStatusIcon(agent.status);
            const statusLabel = this._agentStatusLabel(agent.status);

            return `
                <div class="agent-card ${statusClass}">
                    <div class="agent-header">
                        <span class="agent-badge">${statusIcon}</span>
                        <span class="agent-name">${agent.name}</span>
                    </div>
                    <div class="agent-status">${statusLabel}</div>
                    <div class="agent-desc">${this._truncate(agent.desc, 120)}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renderiza alertas y comunicaciones en 2-columnas
     * @param {Object} alerts — parsed alerts data
     * @param {Object} comms — parsed comms data
     */
    static renderAlertsAndComms(alerts, comms) {
        const container = document.getElementById('alerts-comms');
        if (!container) return;

        const alertItems = (alerts.details || []).slice(0, 5).map(a => `
            <div class="item-row">
                <span class="badge ${this._severityBadgeClass(a.severity)}">
                    ${this._severityIcon(a.severity)} ${a.severity.replace(/[🔴🟡🟢⚠️]\s*/g, '').trim()}
                </span>
                <span class="item-text">${this._truncate(a.description || '', 100)}</span>
                <span class="item-agent">${a.agent || ''}</span>
            </div>
        `).join('') || '<p class="loading">Sin alertas activas</p>';

        const commItems = (comms.details || []).slice(0, 5).map(c => `
            <div class="item-row">
                <span class="badge badge-info">⏳</span>
                <span class="item-text">${this._truncate(c.request || '', 100)}</span>
                <span class="item-agent">${c.from}→${c.to}</span>
            </div>
        `).join('') || '<p class="loading">Sin comunicaciones pendientes</p>';

        container.innerHTML = `
            <div class="column-section">
                <h3>🔴 Alertas Activas (${alerts.active || 0})</h3>
                ${alertItems}
            </div>
            <div class="column-section">
                <h3>💬 Comunicaciones (${comms.pending || 0} pendientes)</h3>
                ${commItems}
            </div>
        `;
    }

    /**
     * Renderiza KPIs específicas de comunicaciones (4 cards)
     * @param {Object} comms — parsed communications data
     */
    static renderCommsKPIs(comms) {
        const container = document.getElementById('comms-kpis');
        if (!container) return;

        const active = comms.active || 0;
        const pending = comms.pending || 0;
        const closed = comms.closed || 0;
        const timeouts = comms.timeout || 0;

        container.innerHTML = `
            <div class="kpi-card kpi-comms-active">
                <div class="kpi-header">
                    <span class="kpi-icon">💬</span>
                    <span class="kpi-title">Activas</span>
                </div>
                <div class="kpi-value">${active}</div>
                <div class="kpi-sub">en seguimiento</div>
            </div>
            <div class="kpi-card kpi-comms-pending">
                <div class="kpi-header">
                    <span class="kpi-icon">⏳</span>
                    <span class="kpi-title">Pendientes</span>
                </div>
                <div class="kpi-value">${pending}</div>
                <div class="kpi-sub">sin respuesta</div>
            </div>
            <div class="kpi-card kpi-comms-closed">
                <div class="kpi-header">
                    <span class="kpi-icon">✅</span>
                    <span class="kpi-title">Cerradas</span>
                </div>
                <div class="kpi-value">${closed}</div>
                <div class="kpi-sub">últimas 24h</div>
            </div>
            <div class="kpi-card kpi-comms-timeout">
                <div class="kpi-header">
                    <span class="kpi-icon">⏱</span>
                    <span class="kpi-title">Timeouts</span>
                </div>
                <div class="kpi-value">${timeouts}</div>
                <div class="kpi-sub">Reviewer bug</div>
            </div>
        `;
    }

    /**
     * Configura el toolbar de comunicaciones (filtros + search)
     * @param {Object} filterState — { statusFilter, searchTerm }
     */
    static renderCommsToolbar(filterState) {
        const toolbar = document.getElementById('comms-toolbar');
        if (!toolbar) return;

        toolbar.innerHTML = `
            <select id="comms-filter-status" class="comms-filter-select">
                <option value="all">Todos los estados</option>
                <option value="pending">⏳ Pendientes</option>
                <option value="timeout">⏱ Timeouts</option>
                <option value="resolved">✅ Resueltas</option>
                <option value="inProgress">🔄 En progreso</option>
            </select>
            <input type="text" id="comms-search" class="comms-search" placeholder="Buscar en pedidos...">
            <button id="comms-sort-toggle" class="btn btn-secondary btn-sm">↕️ Ordenar</button>
        `;

        // Restaurar filtro guardado
        const savedStatus = localStorage.getItem('gn:dashboard:comms:filter:status') || 'all';
        toolbar.querySelector('#comms-filter-status').value = savedStatus;

        const savedSearch = localStorage.getItem('gn:dashboard:comms:search') || '';
        toolbar.querySelector('#comms-search').value = savedSearch;
    }

    /**
     * Renderiza la tabla de comunicaciones con ordenamiento
     * @param {Object} comms — parsed communications data
     * @param {Object} sortState — { key, direction } o null
     * @param {Object} filterState — { statusFilter, searchTerm }
     */
    static renderCommsTable(comms, sortState, filterState) {
        const container = document.getElementById('comms-list-container');
        if (!container) return;

        let rows = comms.details || [];

        // Aplicar filtros
        if (filterState) {
            if (filterState.statusFilter && filterState.statusFilter !== 'all') {
                rows = rows.filter(r => r.status === filterState.statusFilter);
            }
            if (filterState.importanceFilter && filterState.importanceFilter !== 'all') {
                rows = rows.filter(r => r.importanceKey === filterState.importanceFilter);
            }
            if (filterState.searchTerm) {
                const term = filterState.searchTerm.toLowerCase();
                rows = rows.filter(r =>
                    (r.summary || '').toLowerCase().includes(term) ||
                    (r.from || '').toLowerCase().includes(term) ||
                    (r.to || '').toLowerCase().includes(term)
                );
            }
        }

        if (rows.length === 0) {
            container.innerHTML = '<p class="loading">No hay comunicaciones con los filtros aplicados.</p>';
            return;
        }

        // Agrupar por importancia
        const groups = {
            critical: { label: '🔴 CRÍTICAS', items: [] },
            important: { label: '🟡 IMPORTANTES', items: [] },
            routine: { label: '🟢 RUTINARIAS', items: [] },
            unclassified: { label: '❔ SIN CLASIFICAR', items: [] }
        };

        rows.forEach(r => {
            const key = r.importanceKey || 'unclassified';
            if (groups[key]) groups[key].items.push(r);
        });

        // Renderizar cada grupo
        let html = '';
        for (const [key, group] of Object.entries(groups)) {
            if (group.items.length === 0) continue;
            html += `
                <div class="comms-group comms-group--${key}">
                    <div class="comms-group__header">
                        <span class="comms-group__label">${group.label}</span>
                        <span class="comms-group__count">${group.items.length}</span>
                    </div>
                    <div class="comms-group__items">
                        ${group.items.map(d => this._commCardHTML(d)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /** Renderiza una card individual de comm. */
    static _commCardHTML(d) {
        const badgeClass = this._commBadgeClass(d.status);
        const dateCol = d.sourceSection === 'activas' ? d.updated : d.closed;
        const dateLabel = d.sourceSection === 'activas' ? 'Actualizado' : 'Cerrado';
        const typeLabel = d.type ? `<span class="comm-card__type">${this._escape(d.type)}</span>` : '';
        const attemptLabel = d.attempt && d.attempt !== '1' ? `<span class="comm-card__attempt">Intento ${this._escape(d.attempt)}</span>` : '';
        const durationLabel = d.duration ? `<span class="comm-card__duration">⏱ ${this._escape(d.duration)}</span>` : '';

        return `
            <div class="comm-card" onclick="openCommsModal('${d.id}')">
                <div class="comm-card__header">
                    <span class="badge ${badgeClass}">${this._escape(d.statusLabel)}</span>
                    ${typeLabel}
                    ${attemptLabel}
                </div>
                <div class="comm-card__agents">
                    <strong>${this._escape(d.from)}</strong> → <strong>${this._escape(d.to)}</strong>
                </div>
                <div class="comm-card__summary">${this._escape(this._truncate(d.summary, 120))}</div>
                <div class="comm-card__meta">
                    <span>📅 ${this._escape(d.created || '')}</span>
                    ${durationLabel}
                </div>
            </div>
        `;
    }

    /**
     * Renderiza el detalle modal de una comunicación
     * @param {Object} comm — single communication detail
     */
    static renderCommsDetail(comm) {
        const titleEl = document.getElementById('comms-modal-title');
        const bodyEl = document.getElementById('comms-modal-body');
        if (!titleEl || !bodyEl) return;

        titleEl.textContent = comm.id ? `Detalle ${comm.id}` : 'Detalle de comunicación';

        const dateCol = comm.sourceSection === 'activas' ? comm.updated : comm.closed;
        const dateLabel = comm.sourceSection === 'activas' ? 'Última actualización' : 'Cerrado';

        // Buscar conversación completa en COMMS_DETAILS
        const conv = (window.commsDetails && window.commsDetails.conversations)
            ? window.commsDetails.conversations[comm.id]
            : null;

        let blocksHTML = '';
        if (conv && conv.blocks && conv.blocks.length > 0) {
            blocksHTML = conv.blocks.map(b => `
                <div class="comm-detail-block">
                    <div class="comm-detail-block__title">
                        ${this._escape(b.title)}
                        ${b.author ? `<span class="comm-detail-block__author">${this._escape(b.author)}</span>` : ''}
                    </div>
                    <blockquote class="comm-detail-block__quote">${this._escape(b.text)}</blockquote>
                </div>
            `).join('');
        } else {
            blocksHTML = '<p class="loading">Sin conversación detallada. El COMMS_DETAILS.md no tiene entrada para esta comm.</p>';
        }

        const importanceEmoji = { critical: '🔴', important: '🟡', routine: '🟢', unclassified: '❔' }[comm.importanceKey] || '❔';

        bodyEl.innerHTML = `
            <div class="comm-detail-header">
                <span class="comm-detail-importance">${importanceEmoji}</span>
                <span class="comm-detail-title">${this._escape(comm.summary || '')}</span>
            </div>
            <div class="comm-detail-grid">
                <div class="comm-detail-row">
                    <span class="comm-detail-label">De:</span>
                    <span class="comm-detail-value">${this._escape(comm.from)}</span>
                </div>
                <div class="comm-detail-row">
                    <span class="comm-detail-label">A:</span>
                    <span class="comm-detail-value">${this._escape(comm.to)}</span>
                </div>
                <div class="comm-detail-row">
                    <span class="comm-detail-label">Estado:</span>
                    <span class="comm-detail-value">
                        <span class="badge ${this._commBadgeClass(comm.status)}">${comm.statusLabel}</span>
                    </span>
                </div>
                ${comm.type ? `
                <div class="comm-detail-row">
                    <span class="comm-detail-label">Tipo:</span>
                    <span class="comm-detail-value">${this._escape(comm.type)}</span>
                </div>` : ''}
                ${comm.attempt && comm.attempt !== '1' ? `
                <div class="comm-detail-row">
                    <span class="comm-detail-label">Intentos:</span>
                    <span class="comm-detail-value">${this._escape(comm.attempt)}</span>
                </div>` : ''}
                <div class="comm-detail-row">
                    <span class="comm-detail-label">Creado:</span>
                    <span class="comm-detail-value">${this._escape(comm.created)}</span>
                </div>
                <div class="comm-detail-row">
                    <span class="comm-detail-label">${dateLabel}:</span>
                    <span class="comm-detail-value">${this._escape(dateCol || '—')}</span>
                </div>
                ${comm.duration ? `
                <div class="comm-detail-row">
                    <span class="comm-detail-label">Duración:</span>
                    <span class="comm-detail-value">⏱ ${this._escape(comm.duration)}</span>
                </div>` : ''}
            </div>
            <div class="comm-detail-conversation">
                <h4>Conversación</h4>
                ${blocksHTML}
            </div>
        `;

        const modal = document.getElementById('comms-detail-modal');
        if (modal) modal.style.display = 'flex';
    }

    /** Map status → badge CSS class (theme.css) */
    static _commBadgeClass(status) {
        const map = {
            pending:    'badge-pending',
            timeout:    'badge-timeout',
            resolved:   'badge-resolved',
            inProgress: 'badge-inprogress',
            error:      'badge-error',
            unknown:    'badge-info'
        };
        return map[status] || 'badge-info';
    }

    /** Escape HTML para evitar XSS en datos de agentes */
    static _escape(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }

    /**
     * Renderiza los acordeones de logs (7 archivos)
     * @param {Array} files — [{ name, label, success, content, error }]
     */
    static renderAccordions(files) {
        const container = document.getElementById('accordion-container');
        if (!container) return;

        // Orden: TEAM_STATUS.md abierto por default, resto cerrado
        const order = [
            'TEAM_STATUS.md', 'ALERTS_LOG.md', 'COMMS_LOG.md',
            'SESSION_LOG.md', 'BACKLOG.md', 'DECISIONS_LOG.md',
            'PRE_BACKLOG.md'
        ];

        const html = order.map(filename => {
            const file = files.find(f => f.filename === filename);
            const isOpen = filename === 'TEAM_STATUS.md'; // abierto por default
            const configItem = DASHBOARD_CONFIG.files.find(f => f.name === filename);
            const label = configItem ? configItem.label : filename;

            if (!file) {
                return `<div class="accordion">
                    <div class="accordion-header" onclick="toggleAccordion('${filename}')">
                        <span>${label} <span class="status-warning">⚠️</span></span>
                        <span class="accordion-toggle">▸</span>
                    </div>
                </div>`;
            }

            let body = '';
            if (file.success && file.content) {
                try {
                    body = marked.parse(file.content);
                } catch (e) {
                    body = `<div class="card-error">⚠️ Parse error: ${e.message}</div><pre>${file.content}</pre>`;
                }
            } else {
                const is404 = file.error && file.error.includes('no encontrado');
                body = `<div class="card-error">
                    ${file.error || 'Error'}
                    ${is404 ? '' : '<button class="btn btn-secondary btn-sm" onclick="retryAccordion(\'' + filename + '\')">Reintentar</button>'}
                </div>`;
            }

            return `
                <div class="accordion">
                    <div class="accordion-header" onclick="toggleAccordion('${filename}')">
                        <span>${label}</span>
                        <span class="accordion-toggle">${isOpen ? '▾' : '▸'}</span>
                    </div>
                    <div class="accordion-body" id="acc-${filename}" style="display:${isOpen ? 'block' : 'none'}">
                        <div class="markdown-body">${body}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // --- Utils ---

    static _truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '...' : str;
    }

    static _agentStatusClass(status) {
        const map = {
            ok: 'agent-ok', timeout: 'agent-warning',
            running: 'agent-running', idle: 'agent-idle',
            error: 'agent-error', unknown: 'agent-unknown'
        };
        return map[status] || 'agent-unknown';
    }

    static _agentStatusIcon(status) {
        const map = {
            ok: '✅', timeout: '⏱', running: '🔄',
            idle: '⏸', error: '🔴', unknown: '❔'
        };
        return map[status] || '❔';
    }

    static _agentStatusLabel(status) {
        const map = {
            ok: 'Operativo', timeout: 'Timeout', running: 'Running',
            idle: 'Idle', error: 'Error', unknown: 'Desconocido'
        };
        return map[status] || 'Desconocido';
    }

    static _severityBadgeClass(severity) {
        const normalized = severity.toLowerCase();
        if (/🔴|alta|critical/i.test(normalized)) return 'badge-critical';
        if (/🟡|media|medium/i.test(normalized)) return 'badge-medium';
        if (/🟢|baja|low/i.test(normalized)) return 'badge-low';
        return 'badge-info';
    }

    static _severityIcon(severity) {
        const normalized = severity.toLowerCase();
        if (/🔴|alta|critical/i.test(normalized)) return '🔴';
        if (/🟡|media|medium/i.test(normalized)) return '🟡';
        if (/🟢|baja|low/i.test(normalized)) return '🟢';
        return '⚠️';
    }
}

/* Acordeón toggle (global para onclick inline) */
window.toggleAccordion = function(filename) {
    const body = document.getElementById('acc-' + filename);
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    // Persistir estado en localStorage con prefijo gn:
    localStorage.setItem('gn:dashboard:accordion:' + filename, String(isHidden));
};

/* Retry al fallar fetch en acordeón */
window.retryAccordion = function(filename) {
    loadAll(); // delegado a app.js
};

/* Comms modal + sorting (global para onclick inline) */
window.commsData = null;

window.openCommsModal = function(id) {
    if (!window.commsData) return;
    const comm = window.commsData.details.find(c => c.id === id);
    if (comm) DashboardRenderer.renderCommsDetail(comm);
};

window.closeCommsModal = function() {
    const modal = document.getElementById('comms-detail-modal');
    if (modal) modal.style.display = 'none';
};

window.sortComms = function(key) {
    if (typeof window.applyCommsSort === 'function') window.applyCommsSort(key);
};
