/**
 * renderer.js — GW2 Agents Dashboard (Chunk 4: Promociones + Consultas + AgentesCC)
 * Migrated to Andreani Cartesian Design System v1
 */

// =============================================================================
// RENDER: PROMOCIONES (Promotion candidates to origin)
// =============================================================================

export function renderPromociones(data) {
    if (!data || !data.promociones) return alertBox('info', 'Sin promociones', 'No hay features listos para promover.');

    const { candidates, summary, lastPromotion } = data.promociones;

    let html = '';

    if (lastPromotion) {
        html += `<div class="alert alert-success" style="margin-bottom:var(--space-6)"><div class="alert-content"><div class="alert-title">Última promoción</div><div class="alert-message">${lastPromotion.feat} → origin/main (${formatRelativeTime(lastPromotion.timestamp)})</div></div></div>`;
    }

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.ready}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Listos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-info)">${summary.files}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Archivos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.commits}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Commits</div></div></div></div>`;
    }

    if (candidates?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Candidatos</h4>`;
        html += `<div class="promo-container">${candidates.map(c => card(
            `${badge(c.status, c.status.toUpperCase())} ${c.name}`,
            `<div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>Rama:</strong> <code class="cell-mono">${c.branch}</code></div><div><strong>Commits:</strong> ${c.commits}</div></div><div>${c.description}</div><div style="margin-top:var(--space-3)">${c.approved ? btnPrimary('Promover a origin', { onclick: `promoteToOrigin('${c.branch}')` }) : btnGhost('Solicitar revisión', { onclick: `requestReview('${c.branch}')` })}</div>`
        )).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: CONSULTAS (Architect ↔ Principal communications)
// =============================================================================

export function renderConsultas(data) {
    if (!data || !data.consultas) return alertBox('info', 'Sin consultas', 'No hay consultas pendientes.');

    const { threads, summary } = data.consultas;

    let html = '';

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.open}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Abiertas</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-success)">${summary.resolved}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Resueltas</div></div></div></div>`;
    }

    if (threads?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Hilos</h4>`;
        html += `<div class="consultas-container">${threads.map(t => card(
            `${badge(t.status, t.status.toUpperCase())} ${t.subject}`,
            `<div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>De:</strong> ${t.from}</div><div><strong>Iniciado:</strong> ${formatRelativeTime(t.started)}</div></div><div>${t.lastMessage}</div><div style="margin-top:var(--space-3)">${t.status === 'open' ? btnPrimary('Responder', { onclick: `replyConsulta('${t.id}')` }) : btnGhost('Ver historial', { onclick: `viewConsulta('${t.id}')` })}</div>`
        )).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: AGENTES CC (Code Reviewer agents view)
// =============================================================================

export function renderAgentesCC(data) {
    if (!data || !data.agentescc) return alertBox('info', 'Sin datos', 'No hay datos de agentes CC.');

    const { agents, reviews } = data.agentescc;

    let html = '';

    if (agents?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Agentes</h4>`;
        html += `<div class="cc-agents-grid">${agents.map(a => card(a.id, `<div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>Rol:</strong> ${a.role}</div><div><strong>Estado:</strong> ${a.active ? badge('success', 'Activo') : badge('neutral', 'Inactivo')}</div><div><strong>Última revisión:</strong> ${a.lastReview ? formatRelativeTime(a.lastReview) : 'Nunca'}</div><div><strong>Hallazgos:</strong> ${a.findingsCount ?? 0}</div></div>`)).join('')}</div>`;
    }

    if (reviews?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Revisiones recientes</h4>`;
        html += tableWrap(table(
            ['Fecha', 'Agente', 'Archivos', 'Hallazgos', 'Estado'],
            reviews.map(r => ({
                cells: [
                    { html: formatRelativeTime(r.timestamp) },
                    { html: r.agent },
                    { html: r.filesCount },
                    { html: badge(r.severity, `${r.findings} hallazgos`) },
                    { html: r.approved ? badge('success', 'Aprobado') : badge('warning', 'Con cambios') }
                ]
            }))
        ));
    }

    return html;
}