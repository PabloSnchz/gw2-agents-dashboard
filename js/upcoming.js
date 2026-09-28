/**
 * js/upcoming.js
 * Panel "Próximas horas" — Qué está en curso, programado y bloqueado.
 * Fuentes: TEAM_STATUS.md (tareas + crons) + BACKLOG.md (bloqueadas).
 */

class DashboardUpcoming {

    /**
     * Renderiza el panel completo.
     * @param {Object} data — { teamStatus, backlog }
     */
    static render(data) {
        const container = document.getElementById('upcoming-container');
        if (!container) return;

        const inProgress = this._detectInProgress(data.teamStatus);
        const scheduled = this._detectScheduled(data.teamStatus);
        const blocked = this._detectBlocked(data.backlog);

        const total = inProgress.length + scheduled.length + blocked.length;

        if (total === 0) {
            container.innerHTML = `
                <div class="upcoming-empty">
                    ✅ Sin tareas en curso, programadas ni bloqueadas.
                </div>
            `;
            return;
        }

        let html = '';
        if (inProgress.length > 0) html += this._sectionHTML('progress', '🚀 EN CURSO', inProgress);
        if (scheduled.length > 0) html += this._sectionHTML('scheduled', '⏰ PROGRAMADO', scheduled);
        if (blocked.length > 0) html += this._sectionHTML('blocked', '🛑 BLOQUEADO', blocked);

        container.innerHTML = html;
    }

    /**
     * Detecta tareas activas (sin ✅) en TEAM_STATUS.md.
     */
    static _detectInProgress(teamStatus) {
        if (!teamStatus) return [];

        const items = [];
        const md = teamStatus.content || '';

        // Buscar sección "Tareas en curso"
        const sectionMatch = md.match(/##\s*Tareas en curso\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (!sectionMatch) return [];

        const section = sectionMatch[1];
        const lines = section.split('\n');

        let currentAgent = null;

        for (const line of lines) {
            // Detectar agente: "- **default (Principal):** ..."
            const agentMatch = line.match(/^\s*-\s*\*\*([^*]+):\*\*/);
            if (agentMatch) {
                currentAgent = agentMatch[1].trim();
                continue;
            }

            // Detectar sub-bullet activo: "- T1 (cache-busting): ..." sin ✅
            const taskMatch = line.match(/^\s+-\s*(T\d+[^:]*|.+?):\s*(.+)$/);
            if (taskMatch && currentAgent) {
                const taskName = taskMatch[1].trim();
                const taskDesc = taskMatch[2].trim();

                // Excluir si tiene ✅ (completado) o ❌ (error)
                if (!/✅|❌/i.test(taskDesc) && !/completad|resuelt|diagnosticad/i.test(taskDesc)) {
                    items.push({
                        agent: currentAgent,
                        title: `${taskName}`,
                        detail: this._truncate(this._cleanMarkdown(taskDesc), 140)
                    });
                }
            }
        }

        return items;
    }

    /**
     * Detecta próximos disparos de los crons activos.
     */
    static _detectScheduled(teamStatus) {
        if (!teamStatus || !Array.isArray(teamStatus.crons)) return [];

        const items = [];
        const now = new Date();

        teamStatus.crons.forEach(c => {
            // Solo crons activos
            if (!/activo|enabled: true/i.test(c.state || '')) return;

            // Parsear schedule para calcular próximo disparo
            const next = this._nextRun(c.schedule, now);

            items.push({
                time: next ? this._formatTime(next) : '?',
                title: c.name,
                detail: `Agente: ${c.agent} · ${c.schedule || '?'}`,
                eta: next ? this._formatRelative(next) : ''
            });
        });

        // Ordenar por próximo disparo
        items.sort((a, b) => {
            const aMs = a.time === '?' ? Infinity : this._timeToMs(a.time);
            const bMs = b.time === '?' ? Infinity : this._timeToMs(b.time);
            return aMs - bMs;
        });

        return items.slice(0, 10);
    }

    /**
     * Detecta tareas bloqueadas en BACKLOG.md.
     */
    static _detectBlocked(backlog) {
        if (!backlog) return [];

        const items = [];
        const md = backlog.content || '';
        const lines = md.split('\n');

        for (const line of lines) {
            // Buscar: bloqueado, depende de, pendiente de, esperando
            if (/bloquead|depende de|pendiente de|esperando/i.test(line)) {
                const clean = this._cleanMarkdown(line).replace(/^[-*]\s*/, '');
                if (clean.length > 5) {
                    items.push({
                        title: this._truncate(clean, 140),
                        detail: '',
                        action: ''
                    });
                }
            }
        }

        return items.slice(0, 10);
    }

    // --- HELPERS ---

    /**
     * Calcula el próximo disparo de un cron dado su schedule.
     * Soporta los formatos: "*\/30 * * * *" (cada 30 min), "0 *\/2 * * *" (cada 2h en punto).
     */
    static _nextRun(schedule, now) {
        if (!schedule) return null;

        // Extraer la parte de minutos y horas
        const parts = schedule.replace(/`/g, '').trim().split(/\s+/);
        if (parts.length < 5) return null;

        const minutePart = parts[0];
        const hourPart = parts[1];

        const next = new Date(now);

        // Caso 1: "*\/30" → cada 30 min
        const minuteInterval = minutePart.match(/^\*\/(\d+)$/);
        if (minuteInterval) {
            const interval = parseInt(minuteInterval[1], 10);
            const currentMin = next.getMinutes();
            const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
            next.setMinutes(nextMin, 0, 0);
            if (nextMin >= 60) {
                next.setHours(next.getHours() + Math.floor(nextMin / 60));
                next.setMinutes(nextMin % 60);
            }
            return next;
        }

        // Caso 2: "0 *\/2" → cada 2h en punto
        const hourInterval = hourPart.match(/^\*\/(\d+)$/);
        if (hourInterval && minutePart === '0') {
            const interval = parseInt(hourInterval[1], 10);
            const currentHour = next.getHours();
            const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
            next.setHours(nextHour % 24, 0, 0, 0);
            if (nextHour >= 24) {
                next.setDate(next.getDate() + 1);
                next.setHours(nextHour % 24);
            }
            return next;
        }

        // Caso 3: valor fijo de minuto ("0 9 * * *")
        if (/^\d+$/.test(minutePart) && /^\d+$/.test(hourPart)) {
            const min = parseInt(minutePart, 10);
            const hr = parseInt(hourPart, 10);
            next.setHours(hr, min, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next;
        }

        return null;
    }

    static _formatTime(d) {
        if (!d) return '?';
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    static _formatRelative(d) {
        if (!d) return '';
        const diff = d - Date.now();
        if (diff < 0) return 'ahora';
        const min = Math.round(diff / 60000);
        if (min < 60) return `en ${min} min`;
        const h = Math.floor(min / 60);
        return `en ${h}h`;
    }

    static _timeToMs(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    static _sectionHTML(severity, label, items) {
        return `
            <div class="upcoming-group upcoming-group--${severity}">
                <div class="upcoming-group-header">
                    <span>${label}</span>
                    <span class="upcoming-group-count">${items.length}</span>
                </div>
                <ul class="upcoming-list">
                    ${items.map(item => `
                        <li class="upcoming-item">
                            ${item.time ? `<div class="upcoming-item-time">${this._escape(item.time)}</div>` : ''}
                            <div class="upcoming-item-content">
                                <div class="upcoming-item-title">${this._escape(item.title)}</div>
                                ${item.detail ? `<div class="upcoming-item-detail">${this._escape(item.detail)}</div>` : ''}
                                ${item.action ? `<div class="upcoming-item-action">→ ${this._escape(item.action)}</div>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
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

    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }
}
