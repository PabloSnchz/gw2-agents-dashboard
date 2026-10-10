/**
 * renderer.js — GW2 Agents Dashboard (Chunk 5: Live + Timeline + Comms + Utils)
 * Migrated to Andreani Cartesian Design System v1
 */

// =============================================================================
// RENDER: LIVE (Live status / heartbeat monitor)
// =============================================================================

export function renderLive(data) {
    if (!data || !data.live) return alertBox('warning', 'Sin señal', 'No hay datos en vivo.');

    const { agents, system, lastUpdate } = data.live;

    let html = `<p class="org-source">Actualizado: ${formatRelativeTime(lastUpdate)}</p>`;

    // System status
    html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Sistema</h4>`;
    html += `<div class="grid grid-3" style="font-size:var(--text-sm)"><div><strong>QwenPaw:</strong></div><div><strong>Memoria:</strong></div><div><strong>CPU:</strong></div><div>${system.qwenpaw ? badge('success', 'OK') : badge('danger', 'Down')}</div><div>${system.memoryUsage ?? '—'}</div><div>${system.cpuUsage ?? '—'}</div></div>`;

    // Agents live
    if (agents?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Agentes en vivo</h4>`;
        html += `<div class="live-container">${agents.map(a => card(
            `${a.heartbeatOk ? badge('success', 'VIVO') : badge('danger', 'SILENCIADO')} ${a.id}`,
            `<div class="grid grid-3" style="font-size:var(--text-sm)"><div><strong>Último HB:</strong> ${a.lastHeartbeat ? formatRelativeTime(a.lastHeartbeat) : 'Nunca'}</div><div><strong>Sesión:</strong> ${a.sessionId ? `<code class="cell-mono">${a.sessionId.slice(-8)}</code>` : '—'}</div><div><strong>Tokens:</strong> ${a.tokens ? formatNumber(a.tokens) : '—'}</div></div>`
        )).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: TIMELINE (Unified timeline of all events)
// =============================================================================

export function renderTimeline(data) {
    if (!data || !data.timeline) return alertBox('info', 'Sin eventos', 'No hay eventos en la timeline.');

    const { events, filters, range } = data.timeline;

    let html = '';

    // Controls
    html += `<div class="timeline-controls"><div class="timeline-range-group">${['1h', '6h', '24h', '7d'].map(r => btnGhost(r.toUpperCase(), { class: `timeline-range-btn${range === r ? ' active' : ''}`, onclick: `setTimelineRange('${r}')` })).join('')}</div>${select('timeline-agent-filter', 'Agente', [{ value: '', label: 'Todos' }, ...(filters.agents?.map(a => ({ value: a, label: a })) || [])], filters.agent)}<span class="timeline-category-hint">${events.length} eventos</span></div>`;

    // Events
    if (events?.length) {
        html += `<div class="timeline-container">${events.map(e => `<div class="card" style="margin-bottom:var(--space-2)"><div class="card-body"><div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap"><span class="badge badge-${e.level}">${e.level.toUpperCase()}</span><strong>${e.title}</strong><span class="cell-mono" style="margin-inline-start:auto">${formatRelativeTime(e.timestamp)}</span></div><div style="margin-top:var(--space-2);font-size:var(--text-sm);color:var(--text-secondary)">${e.message}</div><div style="margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">${e.source} · ${e.agent || 'sistema'}</div></div></div>`).join('')}</div>`;
    } else {
        html += alertBox('info', 'Sin eventos', 'No hay eventos para el rango seleccionado.');
    }

    return html;
}

// =============================================================================
// RENDER: COMMS (Inter-agent communications)
// =============================================================================

export function renderComms(data) {
    if (!data || !data.comms) return alertBox('info', 'Sin comunicaciones', 'No hay mensajes entre agentes.');

    const { channels, messages, kpis, toolbar } = data.comms;

    let html = '';

    // KPIs
    if (kpis) {
        html += `<div class="comms-kpi-grid"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${kpis.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${kpis.waiting}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Esperando</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-danger)">${kpis.overdue}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Vencidos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-success)">${kpis.answered}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Respondidos</div></div></div></div>`;
    }

    // Toolbar
    if (toolbar) {
        html += `<div class="comms-toolbar">${btnGhost('Actualizar', { onclick: 'refreshComms()' })} ${select('comms-channel-filter', 'Canal', [{ value: '', label: 'Todos' }, ...(toolbar.channels?.map(c => ({ value: c, label: c })) || [])], toolbar.selectedChannel)} ${btnGhost('Exportar', { onclick: 'exportComms()' })}</div>`;
    }

    // Channels
    if (channels?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Canales</h4>`;
        html += `<div class="comms-channel-estado">${channels.map(ch => card(
            `${badge(ch.status, ch.status.toUpperCase())} ${ch.name}`,
            `<div class="comms-channel-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-xl)">${ch.pending}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Pendientes</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-xl);color:var(--text-danger)">${ch.overdue}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Vencidos</div></div></div></div><div class="comms-channel-lista">${ch.messages?.map(m => `<div class="alert alert-${m.status}" style="margin:var(--space-1) 0"><div class="alert-content"><div class="alert-title">${m.from} → ${m.to}</div><div class="alert-message">${m.subject}</div></div></div>`).join('') || '<em style="color:var(--text-tertiary)">Sin mensajes</em>'}</div>`
        )).join('')}</div>`;
    }

    // All messages flat list
    if (messages?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Todos los mensajes</h4>`;
        html += `<div class="comms-list-container">${messages.map(m => `<details class="accordion"><summary class="accordion-header">${badge(m.status, m.status.toUpperCase())} ${m.from} → ${m.to}: ${m.subject}<span class="accordion-toggle">▸</span></summary><div class="accordion-body"><div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>Enviado:</strong> ${formatRelativeTime(m.sent)}</div><div><strong>Plazo:</strong> ${m.deadline ? formatRelativeTime(m.deadline) : 'Sin plazo'}</div></div><div>${m.body}</div></div></details>`).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// UTILIDADES GLOBALES
// =============================================================================

export function showToast(type, title, message) {
    const container = document.getElementById('toast-container') || (() => {
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.style.cssText = 'position:fixed;bottom:var(--space-6);right:var(--space-6);z-index:var(--z-index-toast);display:flex;flex-direction:column;gap:var(--space-2);pointer-events:none';
        document.body.appendChild(c);
        return c;
    })();
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `<div class="alert alert-${type}" style="margin:0"><div class="alert-content"><div class="alert-title">${title}</div><div class="alert-message">${message}</div></div></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

export function openModal(id) {
    const overlay = document.getElementById(`${id}-overlay`);
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        const closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    }
}

export function closeModal(id) {
    const overlay = document.getElementById(`${id}-overlay`);
    if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

export function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    }
}

// Initialize mobile sidebar overlay click handler
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
    // Toast container
    if (!document.getElementById('toast-container')) {
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.style.cssText = 'position:fixed;bottom:var(--space-6);right:var(--space-6);z-index:var(--z-index-toast);display:flex;flex-direction:column;gap:var(--space-2);pointer-events:none';
        document.body.appendChild(c);
    }
});