/**
 * js/attention.js
 * Panel "Requiere tu atención" — items que necesitan decisión de Pablo.
 * Fuentes: ALERTS_LOG + COMMS_LOG + TEAM_STATUS + BACKLOG + SESSION_LOG.
 */

class DashboardAttention {

    /**
     * Renderiza el panel completo.
     * @param {Object} data — { alerts, comms, teamStatus, backlog, sessionLog, commits }
     */
    static render(data) {
        const container = document.getElementById('attention-container');
        if (!container) return;

        // 1) Detectar items por severidad
        const items = {
            critical: this._detectCritical(data),
            medium: this._detectMedium(data),
            low: this._detectLow(data)
        };

        const total = items.critical.length + items.medium.length + items.low.length;

        // 2) Si no hay items, mostrar mensaje
        if (total === 0) {
            container.innerHTML = `
                <div class="attention-empty">
                    ✅ Nada pendiente. Todo al día.
                </div>
            `;
            return;
        }

        // 3) Renderizar por secciones
        let html = '';
        if (items.critical.length > 0) html += this._sectionHTML('critical', '🔴 CRÍTICO', items.critical);
        if (items.medium.length > 0) html += this._sectionHTML('medium', '🟡 MEDIO', items.medium);
        if (items.low.length > 0) html += this._sectionHTML('low', '🟢 BAJO', items.low);

        container.innerHTML = html;
    }

    // --- DETECCIÓN ---

    static _detectCritical(data) {
        const items = [];

        // 1) Crons pausados
        const crons = data.teamStatus?.crons || [];
        crons.forEach(c => {
            if (/pausad|paused|disabled/i.test(c.state || '')) {
                items.push({
                    title: `Cron "${c.name}" pausado`,
                    detail: `Agente: ${c.agent} · Última: ${c.lastRun || 'nunca'}`,
                    action: `Reactivar con qwenpaw cron resume ${c.id}`
                });
            }
        });

        // 2) Alertas críticas activas
        const alerts = data.alerts?.details || [];
        alerts.forEach(a => {
            if (/🔴|alta|critical/i.test(a.severity || '')) {
                items.push({
                    title: 'Alerta crítica sin resolver',
                    detail: a.description || '',
                    action: `Agente: ${a.agent || 'desconocido'}`
                });
            }
        });

        // 3) Comunicaciones >6h en vuelo
        const comms = data.comms?.details || [];
        comms.forEach(c => {
            if (c.sourceSection === 'activas' && /pending|inProgress|timeout/.test(c.status)) {
                const age = this._ageHours(c.created);
                if (age > 6) {
                    items.push({
                        title: `Comunicación en vuelo hace ${age.toFixed(0)}h`,
                        detail: `${c.from} → ${c.to}: "${c.summary?.substring(0, 80) || ''}"`,
                        action: 'Revisar y cerrar/reintentar'
                    });
                }
            }
        });

        // 4) Agentes caídos (sin actividad >6h)
        const agents = data.teamStatus?.agents || [];
        agents.forEach(a => {
            if (a.status === 'error' || a.status === 'timeout') {
                items.push({
                    title: `Agente "${a.name}" con problemas`,
                    detail: this._truncate(this._cleanMarkdown(a.desc), 140),
                    action: 'Revisar estado'
                });
            }
        });

        // 5) Escalados a Pablo (desde TEAM_STATUS.md) — al principio porque son lo más urgente
        if (data.escalations && Array.isArray(data.escalations)) {
            data.escalations.forEach(e => {
                items.unshift({
                    title: e.title,
                    detail: e.detail,
                    action: e.action
                });
            });
        }

        return items.slice(0, 10);
    }

    static _detectMedium(data) {
        const items = [];

        // 1) Comunicaciones >2h y <=6h en vuelo
        const comms = data.comms?.details || [];
        comms.forEach(c => {
            if (c.sourceSection === 'activas' && /pending|inProgress/.test(c.status)) {
                const age = this._ageHours(c.created);
                if (age > 2 && age <= 6) {
                    items.push({
                        title: `Comunicación pendiente hace ${age.toFixed(0)}h`,
                        detail: `${c.from} → ${c.to}: "${c.summary?.substring(0, 80) || ''}"`,
                        action: 'Revisar'
                    });
                }
            }
        });

        // 2) Alertas medias activas
        const alerts = data.alerts?.details || [];
        alerts.forEach(a => {
            if (/🟡|media|medium/i.test(a.severity || '')) {
                items.push({
                    title: 'Alerta media sin resolver',
                    detail: this._truncate(this._cleanMarkdown(a.description), 140),
                    action: `Agente: ${a.agent || 'desconocido'}`
                });
            }
        });

        // 3) Timeouts registrados en el log
        const sessions = data.sessionLog?.content || '';
        const matches = sessions.match(/timeout|timed out/gi);
        if (matches && matches.length > 0) {
            items.push({
                title: `Timeouts registrados en el log: ${matches.length}`,
                detail: 'Pueden ser de distintos períodos. Revisá SESSION_LOG.md para detalles.',
                action: 'Revisar timeouts'
            });
        }

        return items.slice(0, 10);
    }

    static _detectLow(data) {
        const items = [];

        // 1) Tareas en BACKLOG sin resolver
        const backlog = data.backlog?.content || '';
        const pendingTasks = (backlog.match(/^- \[ \]|🟡/gm) || []).length;
        if (pendingTasks > 0) {
            items.push({
                title: `${pendingTasks} tarea(s) pendiente(s) en BACKLOG`,
                detail: 'Revisar BACKLOG.md',
                action: 'Ver detalle'
            });
        }

        // 2) Comunicaciones cerradas sin consumir
        const comms = data.comms?.details || [];
        comms.forEach(c => {
            if (c.sourceSection === 'activas' && c.status === 'resolved') {
                items.push({
                    title: `Comunicación resuelta sin consumir`,
                    detail: `${c.from} → ${c.to}: "${c.summary?.substring(0, 80) || ''}"`,
                    action: 'Consumir'
                });
            }
        });

        return items.slice(0, 10);
    }

    // --- HELPERS ---

    static _ageHours(dateStr) {
        if (!dateStr) return 0;
        const d = new Date(dateStr.replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return 0;
        return (Date.now() - d.getTime()) / (1000 * 60 * 60);
    }

    static _sectionHTML(severity, label, items) {
        return `
            <div class="attention-section attention-section--${severity}">
                <div class="attention-section__header">
                    <span class="attention-section__label">${label}</span>
                    <span class="attention-section__count">${items.length}</span>
                </div>
                <ul class="attention-list">
                    ${items.map(item => `
                        <li class="attention-item">
                            <div class="attention-item__title">${this._escape(item.title)}</div>
                            ${item.detail ? `<div class="attention-item__detail">${this._escape(item.detail)}</div>` : ''}
                            ${item.action ? `<div class="attention-item__action">→ ${this._escape(item.action)}</div>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }

    static _cleanMarkdown(str) {
        if (!str) return '';
        return String(str)
            .replace(/\*\*/g, '')
            .replace(/`/g, '')
            .replace(/⏱|✅|🔄|⏳|❌|🔴|🟡|🟢|⚠️|🚀|📝|🧹|♻️|🧪|🎨|⚡|🔁|📦|🔀|↩️|💓/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static _truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }
}