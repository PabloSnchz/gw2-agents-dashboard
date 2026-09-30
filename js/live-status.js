/**
 * js/live-status.js
 * Panel "Estado en vivo" — Vista rápida del estado de cada agente.
 * Fuentes: commits + SESSION_LOG + el canal REAL de cada agente, que viene
 * de data/estructura.json (crons y heartbeats verificados por el Arquitecto).
 *
 * El estado de actividad sigue siendo estimado a partir de commits y menciones:
 * el dashboard no habla con QwenPaw. Lo que NO es estimado es el canal: antes
 * Reviewer y Documentador venian marcados como "caidos por timeout" de forma
 * fija, sin mirar nada. Eso era falso. Ahora cada tarjeta dice si el agente
 * tiene un heartbeat o no.
 */

class DashboardLiveStatus {

    static AGENTS = [
        { id: 'principal-desarrollo', nombre: 'Principal (Desarrollo)', refAgente: 'default', icon: '🚀', scopes: ['legendary', 'feature', 'feat', 'commit'] },
        { id: 'principal-admin',      nombre: 'Principal (Admin)',      refAgente: 'default', icon: '⚙️', scopes: ['comms', 'admin', 'session', 'chore'] },
        { id: 'po',          nombre: 'PO',          refAgente: 'product-owner', icon: '📝', scopes: ['po', 'backlog'] },
        { id: 'reviewer',    nombre: 'Code Reviewer', refAgente: 'Code-Reviewer',  icon: '🔍', scopes: ['reviewer', 'review'] },
        { id: 'documenter',  nombre: 'Documentador',  refAgente: 'documenter',  icon: '📚', scopes: ['docs', 'doc'] },
        { id: 'architect',   nombre: 'Arquitecto',   refAgente: 'architect',   icon: '🏗️', scopes: ['estructura', 'org', 'dashboard', 'mcp', 'permiso'] }
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
        const agentName = (agent.nombre || '').toLowerCase().split(' ')[0];
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

        // 3) Canal real del agente (viene verificado, no estimado)
        const canal = this._canalDe(agent, data.structure);

        // 4) Estado de actividad (estimado por actividad, como antes)
        let status = 'unknown';
        const hasRecentAlert = (data.alerts?.details || []).some(a =>
            new RegExp(agent.nombre, 'i').test(a.agent || '')
        );
        if (hasRecentAlert) {
            status = 'error';
        } else if (ageMin === Infinity) {
            status = 'unknown';
        } else if (canal.activo && ageMin < 10) {
            status = 'active';
        } else if (canal.activo && ageMin < canal.ventanaMin) {
            status = 'heartbeat';
        } else if (ageMin < 360) {
            status = 'idle';
        } else {
            status = 'idle';
        }

        // 5) Texto de "qué está haciendo"
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
            canal,
            lastActivity,
            ageMin,
            currentActivity,
            lastCommit
        };
    }

    /**
     * Canal real del agente, leido de data/estructura.json (verificado por el
     * Arquitecto contra agent.json + qwenpaw cron list + procesos vivos).
     *
     * No inventa: si el JSON no llego, dice "sin dato" en vez de asumir.
     * La ventana es cuanto aguantamos sin ver actividad antes de suponer
     * que algo se rompio: sale del timeout real configurado, no de un numero redondo.
     */
    static _canalDe(agent, structure) {
        const filas = (structure && structure.agentes) || [];
        const fila = filas.find(a => a.id === agent.refAgente);
        if (!fila) {
            return { activo: false, ventanaMin: 360, texto: 'Canal: sin dato (estructura no cargada)', tono: 'neutro' };
        }

        const hb = fila.heartbeat || {};
        const esEcosistema = !fila.id.startsWith('QwenPaw_');

        if (hb.mecanismo === 'cron' && hb.cron_expr) {
            return {
                activo: esEcosistema,
                ventanaMin: hb.timeout_s ? hb.timeout_s / 60 : 60,
                texto: 'Canal: cron ' + hb.cron_expr + ' UTC' + (hb.proposito ? ' (' + hb.proposito + ')' : ''),
                tono: 'ok'
            };
        }
        if (hb.agent_json_enabled) {
            return {
                activo: true,
                ventanaMin: hb.timeout_s ? hb.timeout_s / 60 : 120,
                texto: 'Canal: heartbeat ' + hb.agent_json_every + ' (agent.json)',
                tono: 'ok'
            };
        }
        if (hb.mecanismo === 'ninguno') {
            return {
                activo: false,
                ventanaMin: 360,
                texto: 'Canal: sin heartbeat, bajo demanda',
                tono: 'neutro'
            };
        }
        return {
            activo: false,
            ventanaMin: 360,
            texto: 'Canal: ' + (hb.mecanismo || 'desconocido'),
            tono: 'neutro'
        };
    }

    static _cardHTML(s) {
        const statusLabel = this._statusLabel(s.status);
        const canal = s.canal;
        const statusEmoji = this._statusEmoji(s.status);
        const ageText = s.ageMin === Infinity ? 'sin data' : this._formatAge(s.ageMin);
        const commitText = s.lastCommit
            ? `Último commit: ${this._formatAge((Date.now() - new Date(s.lastCommit.commit.author.date).getTime()) / 60000)}`
            : '';

        return `
            <div class="live-card live-card--${s.status}">
                <div class="live-card__header">
                    <span class="live-card__icon">${s.agent.icon}</span>
                    <span class="live-card__name">${this._escape(s.agent.nombre)}</span>
                </div>
                <div class="live-card__status">
                    <span class="live-card__status-emoji">${statusEmoji}</span>
                    <span class="live-card__status-label">${statusLabel}</span>
                </div>
                <div class="live-card__activity">${this._escape(s.currentActivity)}</div>
                <div class="live-card__meta">
                    <span class="live-card__canal live-card__canal--${canal.tono}">${this._escape(canal.texto)}</span>
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
