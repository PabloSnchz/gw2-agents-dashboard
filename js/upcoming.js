/**
 * js/upcoming.js
 * Panel "Próximas horas" — Qué está en curso, programado y bloqueado + ideas del PO.
 * Fuentes: CRON_SCHEDULE.md (nuevo) con fallback a TEAM_STATUS.md + BACKLOG.md.
 */

class DashboardUpcoming {

    static render(data) {
        const container = document.getElementById('upcoming-container');
        if (!container) return;

        // Si viene cronSchedule parseado, usar sus datos. Sino, fallback a detectores locales.
        const hasSchedule = data.cronSchedule && data.cronSchedule.parseable;

        const inProgress = hasSchedule
            ? this._inProgressFromSchedule(data.cronSchedule)
            : this._detectInProgress(data.teamStatus);

        const scheduled = hasSchedule
            ? this._scheduledFromSchedule(data.cronSchedule)
            : this._detectScheduled(data.teamStatus);

        const blocked = hasSchedule
            ? this._blockedFromSchedule(data.cronSchedule)
            : this._detectBlocked(data.backlog);

        const ideas = (data.poIdeas && data.poIdeas.parseable)
            ? data.poIdeas.topPriorities
            : [];

        // NUEVO: ramas en desarrollo
        const branches = (data.inProgress && data.inProgress.parseable)
            ? data.inProgress.branches
            : [];

        // NUEVO: items listos para promover
        const readyToPromote = (data.readyForPromotion && data.readyForPromotion.parseable)
            ? data.readyForPromotion.items
            : [];

        const total = inProgress.length + scheduled.length + blocked.length + ideas.length + branches.length + readyToPromote.length;

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
        if (ideas.length > 0) html += this._sectionHTML('ideas', '💡 IDEAS DEL PO', ideas.map(i => ({
            title: `${i.rank || ''} ${i.idea || ''}`.trim(),
            detail: [i.difficulty, i.state, i.eta ? `ETA: ${i.eta}` : ''].filter(Boolean).join(' · ')
        })));
        if (branches.length > 0) html += this._sectionHTML('inprogress-branches', '🔨 EN DESARROLLO', branches.map(b => ({
            title: b.item || b.branch,
            detail: [b.branch, b.state, b.started ? `Iniciada: ${b.started}` : '', b.notes].filter(Boolean).join(' · ')
        })));
        if (readyToPromote.length > 0) html += this._sectionHTML('ready-promote', '📦 LISTO PARA PROMOVER', readyToPromote.map(r => ({
            title: r.item,
            detail: [r.branch, r.commits, r.date ? `Fecha: ${r.date}` : '', r.description].filter(Boolean).join(' · ')
        })));

        container.innerHTML = html;
    }

    // --- NUEVO: extraer de CRON_SCHEDULE.md ---

    static _inProgressFromSchedule(schedule) {
        if (!schedule || !Array.isArray(schedule.inProgress)) return [];
        return schedule.inProgress
            .filter(t => t.agent && t.agent !== '—' && t.task && t.task !== '—')
            .map(t => ({
                title: t.task,
                detail: `${t.agent} · ${t.eta || ''} · ${t.state || ''}`.replace(/\s·\s$/, '')
            }));
    }

    static _scheduledFromSchedule(schedule) {
        if (!schedule || !Array.isArray(schedule.crons)) return [];

        const now = new Date();
        const items = [];

        schedule.crons.forEach(c => {
            if (!/activo|enabled/i.test(c.state || '')) return;

            const next = this._nextRun(c.schedule, now);
            const description = schedule.descriptions[c.name] || '';
            const lastResult = (schedule.lastResults || []).find(r => r.cron === c.name);

            // Detalle: agente + schedule + lastRun
            const detailParts = [
                `Agente: ${c.agent}`,
                c.schedule || '',
                c.every ? `(cada ${c.every})` : ''
            ].filter(Boolean);

            // Línea extra de último resultado
            const lastRunText = lastResult
                ? `Último: ${lastResult.lastRun} · ${lastResult.result}`
                : '';

            items.push({
                time: next ? this._formatTime(next) : '?',
                title: c.name,
                detail: detailParts.join(' · '),
                description: description,
                lastRun: lastRunText,
                eta: next ? this._formatRelative(next) : ''
            });
        });

        items.sort((a, b) => {
            const aMs = a.time === '?' ? Infinity : this._timeToMs(a.time);
            const bMs = b.time === '?' ? Infinity : this._timeToMs(b.time);
            return aMs - bMs;
        });

        return items.slice(0, 10);
    }

    static _blockedFromSchedule(schedule) {
        if (!schedule || !Array.isArray(schedule.blocked)) return [];
        return schedule.blocked
            .filter(b => b.task && b.task !== '—')
            .map(b => ({
                title: b.task,
                detail: [b.blockedBy, b.unblocker ? `Desbloquea: ${b.unblocker}` : '', b.notes].filter(Boolean).join(' · '),
                action: ''
            }));
    }

    // --- FALLBACK: detectores locales ---

    static _detectInProgress(teamStatus) {
        if (!teamStatus) return [];
        const items = [];
        const md = teamStatus.content || '';
        const sectionMatch = md.match(/##\s*Tareas en curso\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (!sectionMatch) return [];
        const section = sectionMatch[1];
        const lines = section.split('\n');
        let currentAgent = null;
        for (const line of lines) {
            const agentMatch = line.match(/^\s*-\s*\*\*([^*]+):\*\*/);
            if (agentMatch) { currentAgent = agentMatch[1].trim(); continue; }
            const taskMatch = line.match(/^\s+-\s*(T\d+[^:]*|.+?):\s*(.+)$/);
            if (taskMatch && currentAgent) {
                const taskName = taskMatch[1].trim();
                const taskDesc = taskMatch[2].trim();
                if (!/✅|❌/i.test(taskDesc) && !/completad|resuelt|diagnosticad/i.test(taskDesc)) {
                    items.push({
                        agent: currentAgent,
                        title: taskName,
                        detail: this._truncate(this._cleanMarkdown(taskDesc), 140)
                    });
                }
            }
        }
        return items;
    }

    static _detectScheduled(teamStatus) {
        if (!teamStatus || !Array.isArray(teamStatus.crons)) return [];
        const items = [];
        const now = new Date();
        teamStatus.crons.forEach(c => {
            if (!/activo|enabled: true/i.test(c.state || '')) return;
            const next = this._nextRun(c.schedule, now);
            items.push({
                time: next ? this._formatTime(next) : '?',
                title: c.name,
                detail: `Agente: ${c.agent} · ${c.schedule || '?'}`,
                eta: next ? this._formatRelative(next) : ''
            });
        });
        items.sort((a, b) => {
            const aMs = a.time === '?' ? Infinity : this._timeToMs(a.time);
            const bMs = b.time === '?' ? Infinity : this._timeToMs(b.time);
            return aMs - bMs;
        });
        return items.slice(0, 10);
    }

    static _detectBlocked(backlog) {
        if (!backlog) return [];
        const items = [];
        const md = backlog.content || '';
        md.split('\n').forEach(line => {
            if (/bloquead|depende de|pendiente de|esperando/i.test(line)) {
                const clean = this._cleanMarkdown(line).replace(/^[-*]\s*/, '');
                if (clean.length > 5) items.push({ title: this._truncate(clean, 140), detail: '', action: '' });
            }
        });
        return items.slice(0, 10);
    }

    // --- HELPERS ---

    static _nextRun(schedule, now) {
        if (!schedule) return null;
        const parts = schedule.replace(/`/g, '').trim().split(/\s+/);
        if (parts.length < 5) return null;
        const minutePart = parts[0];
        const hourPart = parts[1];
        const next = new Date(now);

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

        const hourInterval = hourPart.match(/^\*\/(\d+)$/);
        if (hourInterval && minutePart === '0') {
            const interval = parseInt(hourInterval[1], 10);
            const currentHour = next.getHours();
            const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
            next.setHours(nextHour % 24, 0, 0, 0);
            if (nextHour >= 24) { next.setDate(next.getDate() + 1); next.setHours(nextHour % 24); }
            return next;
        }

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
                                ${item.description ? `<div class="upcoming-item-description">${this._escape(item.description)}</div>` : ''}
                                ${item.lastRun ? `<div class="upcoming-item-lastrun">${this._escape(item.lastRun)}</div>` : ''}
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
            .replace(/\*\*/g, '').replace(/`/g, '')
            .replace(/⏱|✅|🔄|⏳|❌|🔴|🟡|🟢|⚠️|🚀|📝|🧹|♻️|🧪|🎨|⚡|🔁|📦|🔀|↩️|💓/g, '')
            .replace(/\s+/g, ' ').trim();
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