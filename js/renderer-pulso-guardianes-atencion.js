/**
 * renderer.js — GW2 Agents Dashboard (Chunk 2: Pulso + Guardianes + Atención)
 * Migrated to Andreani Cartesian Design System v1
 */

// =============================================================================
// RENDER: PULSO (Health check del ecosistema)
// =============================================================================

export function renderPulso(data) {
    if (!data || !data.pulso) return alertBox('warning', 'Sin datos', 'No hay datos de pulso disponibles.');

    const { timestamp, agents, crons, mcp, disk, github, alerts } = data.pulso;

    let html = `<p class="org-source">Última actualización: ${formatRelativeTime(timestamp)}</p>`;

    // Agents health
    if (agents?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Agentes</h4>`;
        html += tableWrap(table(
            ['Agente', 'Estado', 'Último HB', 'Tokens (24h)', 'Errores'],
            agents.map(a => ({
                class: a.healthy ? '' : 'table-row-danger',
                cells: [
                    { html: `<strong>${a.id}</strong>` },
                    { html: a.healthy ? badge('success', 'OK') : badge('danger', 'FAIL') },
                    { html: a.lastHeartbeat ? formatRelativeTime(a.lastHeartbeat) : '—' },
                    { html: a.tokens24h ? formatNumber(a.tokens24h) : '—' },
                    { html: a.errors > 0 ? badge('warning', a.errors) : badge('neutral', '0') }
                ]
            }))
        ));
    }

    // Crons health
    if (crons?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Crons</h4>`;
        html += tableWrap(table(
            ['ID', 'Agente', 'Schedule', 'Última ejecución', 'Estado', 'Próx. ejecución'],
            crons.map(c => ({
                class: c.healthy ? '' : 'table-row-warning',
                cells: [
                    { html: `<code class="cell-mono">${c.id}</code>` },
                    { html: c.agent },
                    { html: `<code class="cell-mono">${c.schedule}</code>` },
                    { html: c.lastRun ? formatRelativeTime(c.lastRun) : 'Nunca' },
                    { html: c.healthy ? badge('success', 'OK') : badge('warning', 'Degradado') },
                    { html: c.nextRun ? formatRelativeTime(c.nextRun) : '—' }
                ]
            }))
        ));
    }

    // MCP health
    if (mcp) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">MCP</h4>`;
        html += `<div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>Servidor:</strong></div><div>${mcp.serverHealthy ? badge('success', 'Conectado') : badge('danger', 'Desconectado')}</div><div><strong>Directorios:</strong></div><div>${mcp.dirsHealthy ? badge('success', 'OK') : badge('warning', 'Parcial')}</div><div><strong>Latencia:</strong></div><div>${mcp.latencyMs ? `${mcp.latencyMs}ms` : '—'}</div></div>`;
    }

    // Disk
    if (disk) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Disco</h4>`;
        html += `<div class="grid grid-3" style="font-size:var(--text-sm)"><div><strong>Total:</strong></div><div><strong>Usado:</strong></div><div><strong>Libre:</strong></div><div>${formatNumber(disk.totalGB)} GB</div><div>${formatNumber(disk.usedGB)} GB</div><div>${formatNumber(disk.freeGB)} GB</div></div>`;
    }

    // GitHub
    if (github) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">GitHub</h4>`;
        html += `<div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>API:</strong></div><div>${github.apiHealthy ? badge('success', 'OK') : badge('danger', 'Fail')}</div><div><strong>Rate limit:</strong></div><div>${github.rateLimitRemaining}/${github.rateLimitTotal}</div></div>`;
    }

    // Alerts
    if (alerts?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Alertas recientes</h4>`;
        html += `<div class="accordion-container">${alerts.slice(0, 10).map(a => `<details class="accordion"><summary class="accordion-header">${a.level === 'critical' ? badge('danger', 'CRIT') : badge('warning', 'WARN')} ${a.message}<span class="accordion-toggle">▸</span></summary><div class="accordion-body"><div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>Origen:</strong> ${a.source}</div><div><strong>Hora:</strong> ${formatRelativeTime(a.timestamp)}</div></div></div></details>`).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: GUARDIANES (Code Reviewer findings)
// =============================================================================

export function renderGuardianes(data) {
    if (!data || !data.guardianes) return alertBox('info', 'Sin hallazgos', 'No hay hallazgos del Code Reviewer.');

    const { findings, summary } = data.guardianes;

    let html = '';

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-danger)">${summary.critical}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Críticos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.high}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Altos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-info)">${summary.medium}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Medios</div></div></div></div>`;
    }

    if (findings?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Hallazgos</h4>`;
        html += `<div class="accordion-container">${findings.map(f => `<details class="accordion"><summary class="accordion-header">${badge(f.severity, f.severity.toUpperCase())} ${f.title}<span class="accordion-toggle">▸</span></summary><div class="accordion-body"><div style="margin-bottom:var(--space-3)"><strong>Archivo:</strong> <code class="cell-mono">${f.file}</code>${f.line ? ` <strong>Línea:</strong> <code class="cell-mono">${f.line}</code>` : ''}</div><div style="margin-bottom:var(--space-3)"><strong>Descripción:</strong> ${f.description}</div>${f.suggestion ? `<div><strong>Sugerencia:</strong> ${f.suggestion}</div>` : ''}</div></details>`).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: ATENCIÓN (Items que requieren acción)
// =============================================================================

export function renderAtencion(data) {
    if (!data || !data.atencion) return alertBox('info', 'Todo tranquilo', 'No hay items que requieran atención.');

    const { items, summary } = data.atencion;

    let html = '';

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-danger)">${summary.urgent}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Urgentes</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.pending}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Pendientes</div></div></div></div>`;
    }

    if (items?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Items</h4>`;
        html += `<div class="attention-container">${items.map(item => card(
            `${badge(item.priority, item.priority.toUpperCase())} ${item.title}`,
            `<div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>Tipo:</strong> ${item.type}</div><div><strong>Desde:</strong> ${formatRelativeTime(item.since)}</div></div><div>${item.description}</div>${item.actions?.length ? `<div style="margin-top:var(--space-3)">${item.actions.map(a => btnPrimary(a.label, { onclick: a.onclick })).join(' ')}</div>` : ''}`
        )).join('')}</div>`;
    }

    return html;
}