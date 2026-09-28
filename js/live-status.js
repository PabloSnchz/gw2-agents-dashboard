/**
 * js/live-status.js
 * Panel "Estado en vivo" — Vista rápida del estado de cada agente.
 * Fuentes: commits + SESSION_LOG + TEAM_STATUS.
 * Nota: sin QwenPaw local, el estado es estimado.
 */

class DashboardLiveStatus {

    static AGENTS = [
        { id: 'principal-desarrollo', name: 'Principal (Desarrollo)', icon: '🚀', chatType: 'dev', scopes: ['legendary', 'feature', 'feat', 'commit'] },
        { id: 'principal-admin', name: 'Principal (Admin)', icon: '⚙️', chatType: 'admin', scopes: ['comms', 'admin', 'session', 'chore'] },
        { id: 'po', name: 'PO', icon: '📝', chatType: 'heartbeat', scopes: ['po', 'backlog'] },
        { id: 'reviewer', name: 'Code Reviewer', icon: '🔍', chatType: 'timeout', scopes: ['reviewer', 'review'] },
        { id: 'documenter', name: 'Documentador', icon: '📚', chatType: 'timeout', scopes: ['docs', 'doc'] }
    ];

    static render(data) {
        const container = document.getElementById('live-status-container');
        if (!container) return;

        const statuses = this.AGENTS.map(agent => this._computeStatus(agent, data));

        container.innerHTML = statuses.map(s => this._cardHTML(s)).join('');
    }

    /**
     * Calcula el estado de cada agente.
     */
    static _computeStatus(agent, data) {
        const now = Date.now();

        // 1) Último commit relacionado a este agente
        let lastCommit = null;
        let lastCommitTs = 0;
        const commits = data.commits || [];
        commits.forEach(c => {
            const msg = c.commit?.message || '';
            const scopeMatch = msg.match(/\(([^)]+)\)/);
            const scope = scopeMatch ? scopeMatch[1].toLowerCase() : '';
            if (agent.scopes.some(s => scope.includes(s) || msg.toLowerCase().includes(s))) {
                const ts = new Date(c.commit?.author?.date || 0).getTime();
                if (ts > lastCommitTs) {
                    lastCommitTs = ts;
                    lastCommit = c;
                }
            }
        });

        // 2) Última mención en SESSION_LOG
        let lastMentionTs = 0;
        const sessionLog = data.sessionLog || '';
        const agentName = agent.name.toLowerCase().split(' ')[0];
        const logLines = sessionLog.split('\n');
        logLines.forEach(line => {
            const tsMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\]/);
            if (tsMatch && new RegExp(agentName, 'i').test(line)) {
                const ts = new Date(tsMatch[1]).getTime();
                if (ts > lastMentionTs) lastMentionTs = ts;
            }
        });

        const lastActivity = Math.max(lastCommitTs, lastMentionTs);
        const ageMs = lastActivity ? now - lastActivity : Infinity;
        const ageMin = ageMs / 60000;

        // 3) Estado
        let status = 'unknown';
        if (agent.chatType === 'timeout') {
            // Reviewer y Documentador: considerar caídos por timeout
            const hasRecentAlert = (data.alerts?.details || []).some(a =>
                new RegExp(agent.name, 'i').test(a.agent || '')
            );
            status = hasRecentAlert ? 'error' : (ageMin < 60 ? 'idle' : 'idle');
        } else if (ageMin < 10) {
            status = 'active';
        } else if (agent.chatType === 'heartbeat' && ageMin < 180) {
            status = 'heartbeat';
        } else if (ageMin < 120) {
            status = 'idle';
        } else if (ageMin < 360) {
            status = 'idle';
        } else {
            status = 'idle';
        }

        // 4) Texto de "qué está haciendo"
        let currentActivity = 'Sin actividad reciente';
        if (lastCommitTs === lastActivity && lastCommit) {
            const msg = (lastCommit.commit?.message || '').split('\n')[0];
            currentActivity = `Último commit: ${this._truncate(msg, 80)}`;
        } else if (lastMentionTs === lastActivity) {
            currentActivity = 'Mencionado en SESSION_LOG';
        }

        return {
            agent,
            status,
            lastActivity,
            ageMin,
            currentActivity,
            lastCommit
        };
    }

    static _cardHTML(s) {
        const statusLabel = this._statusLabel(s.status);
        const statusEmoji = this._statusEmoji(s.status);
        const ageText = s.ageMin === Infinity ? 'sin data' : this._formatAge(s.ageMin);
        const commitText = s.lastCommit
            ? `Último commit: ${this._formatAge((Date.now() - new Date(s.lastCommit.commit.author.date).getTime()) / 60000)}`
            : '';

        return `
            <div class="live-card live-card--${s.status}">
                <div class="live-card__header">
                    <span class="live-card__icon">${s.agent.icon}</span>
                    <span class="live-card__name">${this._escape(s.agent.name)}</span>
                </div>
                <div class="live-card__status">
                    <span class="live-card__status-emoji">${statusEmoji}</span>
                    <span class="live-card__status-label">${statusLabel}</span>
                </div>
                <div class="live-card__activity">${this._escape(s.currentActivity)}</div>
                <div class="live-card__meta">
                    <span>Última actividad: ${ageText}</span>
                    ${commitText ? `<span>${this._escape(commitText)}</span>` : ''}
                </div>
            </div>
        `;
    }

    static _statusLabel(status) {
        const map = {
            'active': 'ACTIVO',
            'heartbeat': 'HEARTBEAT',
            'idle': 'IDLE',
            'error': 'CAÍDO',
            'unknown': 'SIN DATA'
        };
        return map[status] || 'SIN DATA';
    }

    static _statusEmoji(status) {
        const map = {
            'active': '🟢',
            'heartbeat': '🟡',
            'idle': '⚫',
            'error': '🔴',
            'unknown': '❔'
        };
        return map[status] || '❔';
    }

    static _formatAge(min) {
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${Math.floor(min)} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `hace ${h}h`;
        const d = Math.floor(h / 24);
        return `hace ${d}d`;
    }

    static _truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }
}
