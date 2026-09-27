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
                    ${this._severityIcon(a.severity)} ${a.severity}
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
