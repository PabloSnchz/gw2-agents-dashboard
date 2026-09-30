/**
 * js/upcoming.js
 * Panel "Próximas horas" — Qué está en curso, programado y bloqueado + ideas del PO.
 * Fuentes: CRON_SCHEDULE.md (nuevo) con fallback a TEAM_STATUS.md + BACKLOG.md, y
 * data/estructura.json para contrastar la agenda real contra la que declara el equipo.
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

        // NUEVO: ramas en desarrollo — separadas por VIDA, no por fila.
        const allBranches = (data.inProgress && data.inProgress.parseable)
            ? data.inProgress.branches
            : [];
        const branchesVivas = allBranches.filter(b => b.vivo && b.vivo.viva);
        const branchesMuertas = allBranches.filter(b => b.vivo && !b.vivo.viva);
        window.__branchesVivas = branchesVivas;
        window.__branchesMuertas = branchesMuertas;

        // Items que esperan una DECISIÓN DE PABLO (pregunta pegable). Vienen
        // de las ramas vivas + las cerradas en este ciclo del mismo archivo.
        const decisiones = [];
        allBranches.forEach(b => { if (b.decision) decisiones.push(Object.assign({ rama: b.branch, item: b.item }, b.decision)); });
        if (data.inProgress && Array.isArray(data.inProgress.closedThisCycle)) {
            data.inProgress.closedThisCycle.forEach(b => {
                if (b.decision) decisiones.push(Object.assign({ rama: b.branch, item: b.item }, b.decision));
            });
        }

        // NUEVO: items listos para promover
        const readyToPromote = (data.readyForPromotion && data.readyForPromotion.parseable)
            ? data.readyForPromotion.items
            : [];

        // Programacion real vs la que declara el equipo
        const cronReality = this._cronReality(data.structure, data.cronSchedule);

        const total = inProgress.length + scheduled.length + blocked.length + ideas.length
            + branchesVivas.length + readyToPromote.length + decisiones.length;

        if (total === 0 && !cronReality) {
            container.innerHTML = `
                <div class="upcoming-empty">
                    ✅ Sin tareas en curso, programadas ni bloqueadas.
                </div>
            `;
            return;
        }

        let html = this._cronRealityHTML(cronReality);
        if (decisiones.length > 0) html += this._decisionesHTML(decisiones);
        if (inProgress.length > 0) html += this._sectionHTML('progress', '🚀 EN CURSO', inProgress);
        if (scheduled.length > 0) html += this._sectionHTML('scheduled', '⏰ PROGRAMADO', scheduled);
        if (blocked.length > 0) html += this._sectionHTML('blocked', '🛑 BLOQUEADO', blocked);
        if (ideas.length > 0) html += this._sectionHTML('ideas', '💡 IDEAS DEL PO', ideas.map(i => ({
            title: `${i.rank || ''} ${i.idea || ''}`.trim(),
            detail: [i.difficulty, i.state, i.eta ? `ETA: ${i.eta}` : ''].filter(Boolean).join(' · ')
        })));
        if (branchesVivas.length > 0) html += this._sectionHTML('inprogress-branches', '🔨 EN DESARROLLO', branchesVivas.map(b => ({
            title: b.item || b.branch,
            detail: [b.branch, b.state, b.started ? `Iniciada: ${b.started}` : '', b.notes].filter(Boolean).join(' · ')
        })));
        if (readyToPromote.length > 0) html += this._sectionHTML('ready-promote', '📦 LISTO PARA PROMOVER', readyToPromote.map(r => ({
            title: r.item,
            detail: [r.branch, r.commits, r.date ? `Fecha: ${r.date}` : '', r.description].filter(Boolean).join(' · ')
        })));

        // Contador de ramas cerradas sin limpiar. Va al final, con la
        // explicación de por qué NO se muestran como "en desarrollo".
        if (branchesMuertas.length > 0) {
            html += `
                <div class="upcoming-group upcoming-group--stale">
                    <button class="upcoming-stale-btn" onclick="window.openRamasCerradas()">
                        🧹 <strong>${branchesMuertas.length}</strong> rama${branchesMuertas.length === 1 ? '' : 's'} cerrada${branchesMuertas.length === 1 ? '' : 's'} sin limpiar
                        <span class="upcoming-stale-hint">— click para ver el detalle</span>
                    </button>
                </div>`;
        }

        container.innerHTML = html;
    }

    /**
     * Bloque "necesita tu decisión" — lo primero que se ve, antes de EN CURSO.
     *
     * Cada item trae la pregunta tal cual la escribió el equipo, lista para
     * pegar en el chat de Desarrollo. La pregunta se arma en el parser
     * (_detectaDecision) para que sea siempre la frase del equipo y no una
     * paráfrasis mía que se desincroniza del archivo.
     */
    static _decisionesHTML(decisiones) {
        const items = decisiones.map(d => `
            <li class="decision-item">
                <div class="decision-item__head">
                    <span class="decision-item__rama">${this._escape(d.item || d.rama)}</span>
                    ${d.rama ? `<code class="decision-item__code">${this._escape(d.rama)}</code>` : ''}
                </div>
                <div class="decision-item__motivo">${this._escape(d.motivo)}</div>
                <button class="decision-item__copy" data-decision="${this._escape(d.pregunta)}">
                    📋 Copiar pregunta
                </button>
            </li>`).join('');

        return `
            <section class="upcoming-section upcoming-section--decision">
                <h3>❓ NECESITA TU DECISIÓN <span class="est-badge est-badge--warn">${decisiones.length}</span></h3>
                <p class="org-note">
                    Ítems donde el equipo <strong>no puede avanzar sin una decisión tuya.</strong> La pregunta
                    es la que escribió el equipo en <code>IN_PROGRESS.md</code> — copiala y pegala en
                    el chat de <strong>Desarrollo</strong>.
                </p>
                <ul class="decision-list">${items}</ul>
            </section>`;
    }



    /**
     * Cruza la programación REAL (data/estructura.json, verificada por el
     * Arquitecto contra agent.json + qwenpaw cron list) contra lo que declara
     * CRON_SCHEDULE.md, que escribe el Principal en cada heartbeat.
     *
     * No reemplaza al archivo del equipo: lo ordena y avisa. El problema
     * concreto es que CRON_SCHEDULE.md declara 2 crons cuando hay 4 mecanismos
     * vivos, y los timeouts que figuran ya no son los configurados. Un panel
     * que muestra eso sin contexto hace planning sobre una agenda vieja.
     */
    static _cronReality(est, schedule) {
        if (!est || !Array.isArray(est.agentes)) return null;

        const declarados = (schedule && Array.isArray(schedule.crons)) ? schedule.crons : [];
        const filas = [];

        for (const a of est.agentes) {
            const hb = a.heartbeat || {};
            if (!hb.mecanismo || hb.mecanismo === 'ninguno') continue;

            const ritmo = hb.mecanismo === 'cron' ? hb.cron_expr : hb.agent_json_every;
            const d = declarados.find(x => String(x.agent || '').trim() === a.id);

            if (!d) {
                filas.push({
                    agente: a.nombre,
                    id: a.id,
                    realidad: `${hb.mecanismo === 'cron' ? 'cron' : 'heartbeat'} ${ritmo} · timeout ${hb.timeout_s || '?'}s`,
                    declarado: '—',
                    veredicto: 'falta',
                    detalle: 'El equipo no lo declara en CRON_SCHEDULE.md.'
                });
                continue;
            }

            const difs = [];
            const timeoutDeclarado = parseInt(String(d.timeout || '').replace(/\D/g, ''), 10);
            if (hb.timeout_s && timeoutDeclarado && timeoutDeclarado !== hb.timeout_s) {
                difs.push(`timeout ${timeoutDeclarado}s en el archivo vs ${hb.timeout_s}s real`);
            }
            // Mecanismo: el archivo dice "agent.json" o escribe una expresion cron.
            // "*/30 * * * *" es una expresion cron aunque no contenga la palabra cron.
            const ds = String(d.schedule || '');
            const declaradoEsAgentJson = /agent\.json/i.test(ds);
            const declaradoEsCron = !declaradoEsAgentJson && /[*\/]/.test(ds);
            if (hb.mecanismo === 'cron' && declaradoEsAgentJson) {
                difs.push('dice que corre por agent.json, pero hay un cron real');
            }
            if (hb.mecanismo === 'agent.json' && declaradoEsCron) {
                difs.push('declara una expresión cron, pero el real corre por agent.json');
            }
            if (hb.cron_id && d.id && d.id !== '—' && !String(d.id).startsWith(String(hb.cron_id).substring(0, 8))) {
                difs.push(`cron id ${String(d.id).slice(0, 8)} vs ${String(hb.cron_id).slice(0, 8)}`);
            }

            filas.push({
                agente: a.nombre,
                id: a.id,
                realidad: `${hb.mecanismo === 'cron' ? 'cron' : 'heartbeat'} ${ritmo} · timeout ${hb.timeout_s || '?'}s`,
                declarado: `${String(d.schedule || '').replace(/`/g, '')} · timeout ${d.timeout || '?'}`,
                veredicto: difs.length ? 'difiere' : 'ok',
                detalle: difs.join('; ')
            });
        }

        const ocultos = declarados.filter(d =>
            !filas.some(f => f.id === String(d.agent || '').trim())
        );

        return { filas, ocultos, total: filas.length };
    }

    static _cronRealityHTML(real) {
        if (!real) return '';
        const problemas = real.filas.filter(f => f.veredicto !== 'ok');
        if (problemas.length === 0 && real.ocultos.length === 0) return '';

        const badge = (v) => v === 'ok'
            ? '<span class="est-badge est-badge--ok">al día</span>'
            : (v === 'falta'
                ? '<span class="est-badge est-badge--warn">no declarado</span>'
                : '<span class="est-badge est-badge--danger">difiere</span>');

        const filas = real.filas.map(f => `
            <tr>
                <td><strong>${f.agente}</strong><br><code>${f.id}</code></td>
                <td>${f.realidad}</td>
                <td>${f.declarado}</td>
                <td>${badge(f.veredicto)}${f.detalle ? `<br><span class="org-note">${f.detalle}</span>` : ''}</td>
            </tr>`).join('');

        return `
            <section class="upcoming-section upcoming-section--scheduled">
                <h3>🧭 PROGRAMACIÓN REAL <span class="est-badge est-badge--warn">${problemas.length + real.ocultos.length} desalineado${problemas.length + real.ocultos.length === 1 ? '' : 's'}</span></h3>
                <p class="org-note">
                    Verificado por el Arquitecto contra <code>agent.json</code> de los 6 workspaces y
                    <code>qwenpaw cron list</code>. No viene de CRON_SCHEDULE.md: ese archivo lo escribe
                    el Principal en cada heartbeat, y el equipo no tiene visibilidad de los procesos
                    ni de los <code>agent.json</code> de los otros.
                </p>
                <div class="comms-table-wrapper org-table">
                    <table class="comms-table est-table">
                        <thead><tr><th>Agente</th><th>Realidad</th><th>CRON_SCHEDULE.md dice</th><th>Veredicto</th></tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </section>`;
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

// ============================================================
// MODAL GENERICO + CONTADOR DE RAMAS SIN LIMPIAR
// Globales porque los onclick inline los necesitan en window.
// Mismo patron que el modal de comms en renderer.js.
// ============================================================

window.__branchesVivas = [];
window.__branchesMuertas = [];

/** Abre el modal de ramas cerradas sin limpiar. */
window.openRamasCerradas = function() {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('detail-modal-title');
    const body = document.getElementById('detail-modal-body');
    if (!modal || !title || !body) return;

    const muertas = window.__branchesMuertas || [];
    if (!muertas.length) return;

    title.textContent = `Ramas cerradas sin limpiar (${muertas.length})`;

    const etiquetas = {
        terminada:   { txt: 'Terminada — ya está en main', cls: 'est-badge--ok' },
        redundante:  { txt: 'Redundante — se puede borrar', cls: 'est-badge--danger' },
        no_iniciada: { txt: 'Aprobada pero no iniciada', cls: 'est-badge--warn' }
    };

    const filas = muertas.map(b => {
        const et = etiquetas[b.vivo.motivo] || { txt: b.vivo.motivo || '—', cls: '' };
        return `
            <div class="rama-card">
                <div class="rama-card__head">
                    <code>${DashboardUpcoming._escape(b.branch)}</code>
                    <span class="est-badge ${et.cls}">${this._escape(et.txt)}</span>
                </div>
                <div class="rama-card__item">${DashboardUpcoming._escape(b.item || '—')}</div>
                ${b.state ? `<div class="rama-card__state">${DashboardUpcoming._escape(DashboardParser._limpiaMarkdown(b.state))}</div>` : ''}
                ${b.notes ? `<div class="rama-card__notes">${DashboardUpcoming._escape(DashboardParser._limpiaMarkdown(b.notes))}</div>` : ''}
            </div>`;
    }).join('');

    body.innerHTML = `
        <p class="org-note" style="margin-bottom:12px">
            <strong>${muertas.length}</strong> de ${(window.__branchesVivas || []).length + muertas.length}
            filas de <code>IN_PROGRESS.md</code> ya no son trabajo en curso: el equipo las cerró,
            las marcó redundantes, o las aprobó sin empezarlas. La propia regla 3 del archivo dice
            que una rama descartada se elimina de la lista — no se está cumpliendo. Son
            <strong>items fantasma</strong> inflando el conteo de “en desarrollo”.
        </p>
        ${filas}
        <p class="org-note" style="margin-top:14px">
            Para limpiar: el Principal las borra de <code>IN_PROGRESS.md</code> (las terminadas ya
            están en <code>READY_FOR_PROMOTION.md</code> si corresponde).
        </p>`;

    modal.style.display = 'flex';
};

window.closeDetailModal = function() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
};

// Cerrar con click en el overlay o Escape. Delegado: se registra una sola vez.
if (!window.__detailModalWired) {
    window.__detailModalWired = true;
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('detail-modal');
        if (modal) {
            modal.addEventListener('click', e => { if (e.target === modal) window.closeDetailModal(); });
            modal.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeDetailModal(); });
        }
    });
}

/**
 * Copia la pregunta de decisión al portapapeles.
 *
 * Delegación en vez de onclick inline en cada botón: el texto de la pregunta
 * viene del .md del equipo y puede traer comillas, que romperían el atributo
 * del onclick. Con data-attribute + un solo listener no hay escaping que
 * pueda fallar.
 */
document.addEventListener('click', function (e) {
    const btn = e.target.closest ? e.target.closest('.decision-item__copy') : null;
    if (!btn) return;
    const texto = btn.getAttribute('data-decision') || '';
    const original = btn.innerHTML;
    const ok = () => {
        btn.innerHTML = '✅ Copiada — pegala en el chat de Desarrollo';
        setTimeout(() => { btn.innerHTML = original; }, 2200);
    };
    const fallback = () => {
        // navigator.clipboard falla en http:// (Pages sin TLS) y en algunos
        // navegadores con permiso denegado. Sin fallback, el botón no hace
        // NADA y el usuario no sabe por qué.
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            ok();
        } catch (err) {
            btn.innerHTML = '⚠️ No se pudo copiar — seleccioná el texto a mano';
        }
        document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(ok).catch(fallback);
    } else {
        fallback();
    }
});