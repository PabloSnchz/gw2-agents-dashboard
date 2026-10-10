/**
 * renderer.js — GW2 Agents Dashboard (Chunk 3: PreBacklog + Backlog + Desarrollo)
 * Migrated to Andreani Cartesian Design System v1
 */

// =============================================================================
// RENDER: PRE-BACKLOG (Ideas del PO)
// =============================================================================

export function renderPreBacklog(data) {
    if (!data || !data.prebacklog) return alertBox('info', 'Sin propuestas', 'El PO no tiene propuestas pendientes.');

    const { ideas, summary } = data.prebacklog;

    let html = '';

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ideas</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-info)">${summary.new}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Nuevas</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.review}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">En revisión</div></div></div></div>`;
    }

    if (ideas?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Propuestas</h4>`;
        html += `<div class="prebacklog-container">${ideas.map(idea => card(
            `${badge(idea.status, idea.status.toUpperCase())} ${idea.title}`,
            `<div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>Fuente:</strong> ${idea.source}</div><div><strong>Desde:</strong> ${formatRelativeTime(idea.timestamp)}</div></div><div>${idea.description}</div><div style="margin-top:var(--space-3)">${btnGhost('Ver detalle', { onclick: `openPrebacklogDetail('${idea.id}')` })} ${btnPrimary('Promover a Backlog', { onclick: `promoteToBacklog('${idea.id}')` })}</div>`
        )).join('')}</div>`;
    }

    return html;
}

// =============================================================================
// RENDER: BACKLOG (Items priorizados)
// =============================================================================

export function renderBacklog(data) {
    if (!data || !data.backlog) return alertBox('info', 'Backlog vacío', 'No hay items en el backlog.');

    const { items, summary } = data.backlog;

    let html = '';

    if (summary) {
        html += `<div class="pulso-kpis"><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl)">${summary.total}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-info)">${summary.ready}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Listos</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-warning)">${summary.inProgress}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">En progreso</div></div></div><div class="card"><div class="card-body" style="text-align:center"><div class="cell-mono" style="font-size:var(--text-3xl);color:var(--text-success)">${summary.done}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">Hechos</div></div></div></div>`;
    }

    if (items?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Items</h4>`;
        html += tableWrap(table(
            ['ID', 'Título', 'Estado', 'Prioridad', 'Asignado', 'Acciones'],
            items.map(item => ({
                cells: [
                    { html: `<code class="cell-mono">${item.id}</code>` },
                    { html: `<strong>${item.title}</strong>` },
                    { html: badge(item.status, item.status) },
                    { html: badge(item.priority, item.priority) },
                    { html: item.assignee || '—' },
                    { html: btnGhost('Ver', { onclick: `openBacklogItem('${item.id}')` }) }
                ]
            }))
        ));
    }

    return html;
}

// =============================================================================
// RENDER: DESARROLLO (Estado del repo agents)
// =============================================================================

export function renderDesarrollo(data) {
    if (!data || !data.desarrollo) return alertBox('warning', 'Sin datos', 'No hay datos de desarrollo disponibles.');

    const { clones, ramas, features, worktrees, status } = data.desarrollo;

    let html = '';

    // Clones
    if (clones?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Clones</h4>`;
        html += `<div class="desarrollo-clones">${clones.map(c => card(c.name, `<div class="grid grid-3" style="font-size:var(--text-sm)"><div><strong>Path:</strong> <code class="cell-mono">${c.path}</code></div><div><strong>Remote:</strong> <code class="cell-mono">${c.remote}</code></div><div><strong>HEAD:</strong> <code class="cell-mono">${c.head?.slice(0, 8)}</code></div><div><strong>Branch:</strong> ${c.branch}</div><div><strong>Clean:</strong> ${c.clean ? badge('success', 'Sí') : badge('warning', 'No')}</div><div><strong>Sync:</strong> ${c.synced ? badge('success', 'OK') : badge('danger', 'Desync')}</div></div>`)).join('')}</div>`;
    }

    // Ramas
    if (ramas?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Ramas activas</h4>`;
        html += tableWrap(table(
            ['Rama', 'Tipo', 'Commits', 'Último commit', 'Estado'],
            ramas.map(r => ({
                cells: [
                    { html: `<code class="cell-mono">${r.name}</code>` },
                    { html: badge(r.type, r.type) },
                    { html: r.commitsAhead + ' ↑ / ' + r.commitsBehind + ' ↓' },
                    { html: r.lastCommit ? formatRelativeTime(r.lastCommit) : '—' },
                    { html: r.merged ? badge('success', 'Mergeado') : badge('info', 'Activa') }
                ]
            }))
        ));
    }

    // Features
    if (features?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Features</h4>`;
        html += `<div class="desarrollo-features">${features.map(f => card(
            `${badge(f.status, f.status.toUpperCase())} ${f.name}`,
            `<div class="grid grid-2" style="font-size:var(--text-sm);margin-bottom:var(--space-3)"><div><strong>Rama:</strong> <code class="cell-mono">${f.branch}</code></div><div><strong>Commits:</strong> ${f.commits}</div></div><div>${f.description}</div><div style="margin-top:var(--space-3)">${f.prUrl ? `<a href="${f.prUrl}" target="_blank" class="btn btn-ghost btn-sm">Ver PR</a>` : btnPrimary('Crear PR', { onclick: `createPR('${f.branch}')` })}</div>`
        )).join('')}</div>`;
    }

    // Worktrees
    if (worktrees?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Worktrees</h4>`;
        html += tableWrap(table(
            ['Path', 'Rama', 'HEAD', 'Estado'],
            worktrees.map(w => ({
                class: w.dirty ? 'table-row-warning' : '',
                cells: [
                    { html: `<code class="cell-mono">${w.path}</code>` },
                    { html: `<code class="cell-mono">${w.branch}</code>` },
                    { html: `<code class="cell-mono">${w.head?.slice(0, 8)}</code>` },
                    { html: w.dirty ? badge('warning', 'Con cambios') : badge('success', 'Limpio') }
                ]
            }))
        ));
    }

    return html;
}