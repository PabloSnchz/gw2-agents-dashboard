/**
 * renderer.js — GW2 Agents Dashboard
 * Migrated to Andreani Cartesian Design System v1
 * Uses semantic tokens only. No hex literals. No !important.
 */

import { state } from './state.js';
import { api } from './api.js';
import { formatRelativeTime, formatNumber, formatDuration } from './utils.js';

// =============================================================================
// HELPER: Cartesian component builders
// =============================================================================

function btn(classes, text, attrs = {}) {
    const c = ['btn', ...classes].join(' ');
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<button class="${c}" ${a}>${text}</button>`;
}

function btnPrimary(text, attrs) { return btn(['btn-primary'], text, attrs); }
function btnSecondary(text, attrs) { return btn(['btn-secondary'], text, attrs); }
function btnGhost(text, attrs) { return btn(['btn-ghost'], text, attrs); }
function btnDanger(text, attrs) { return btn(['btn-danger'], text, attrs); }
function btnSm(classes, text, attrs) { return btn([...classes, 'btn-sm'], text, attrs); }

function alertBox(type, title, message) {
    return `<div class="alert alert-${type}" role="alert"><div class="alert-content"><div class="alert-title">${title}</div><div class="alert-message">${message}</div></div></div>`;
}

function chip(text, removable = false, onRemove = '') {
    const r = removable ? `<button class="chip-remove" onclick="${onRemove}">&times;</button>` : '';
    return `<span class="chip chip-removable">${text}${r}</span>`;
}

function badge(type, text) {
    return `<span class="badge badge-${type}">${text}</span>`;
}

function card(title, body, footer = '') {
    return `<article class="card"><header class="card-header"><h3 class="card-title">${title}</h3></header><div class="card-body">${body}</div>${footer ? `<footer class="card-footer">${footer}</footer>` : ''}</article>`;
}

function tableWrap(html) {
    return `<div class="table-wrap">${html}</div>`;
}

function table(headers, rows, opts = {}) {
    const head = headers.map(h => `<th>${h}</th>`).join('');
    const body = rows.map(r => `<tr${r.class ? ` class="${r.class}"` : ''}>${r.cells.map(c => `<td${c.class ? ` class="${c.class}"` : ''}>${c.html}</td>`).join('')}</tr>`).join('');
    return `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function accordion(items) {
    return `<div class="accordion-container">${items.map(item => `<details class="accordion"${item.open ? ' open' : ''}><summary class="accordion-header">${item.title}<span class="accordion-toggle">▸</span></summary><div class="accordion-body">${item.content}</div></details>`).join('')}</div>`;
}

function modal(id, title, body, footer) {
    return `<div class="modal-overlay" id="${id}-overlay" tabindex="-1" aria-hidden="true"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><header class="modal-header"><h2 class="modal-title" id="${id}-title">${title}</h2><button class="modal-close" onclick="closeModal('${id}')" aria-label="Cerrar">&times;</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}</div></div>`;
}

function toast(type, title, message) {
    const id = `toast-${Date.now()}`;
    return `<div class="toast" id="${id}" role="alert" aria-live="polite">${alertBox(type, title, message)}</div>`;
}

function input(id, label, type = 'text', placeholder = '', value = '', error = '') {
    return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><input class="input${error ? ' input-error' : ''}" type="${type}" id="${id}" placeholder="${placeholder}" value="${value}"${error ? ` aria-invalid="true" aria-describedby="${id}-error"` : ''}>${error ? `<span class="form-error" id="${id}-error">${error}</span>` : ''}</div>`;
}

function select(id, label, options, value = '', error = '') {
    const opts = options.map(o => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`).join('');
    return `<div class="form-group"><label class="form-label" for="${id}">${label}</label><select class="select${error ? ' select-error' : ''}" id="${id}"${error ? ` aria-invalid="true" aria-describedby="${id}-error"` : ''}>${opts}</select>${error ? `<span class="form-error" id="${id}-error">${error}</span>` : ''}</div>`;
}

function checkbox(id, label, checked = false, name = '') {
    return `<label class="checkbox-inline"><input type="checkbox" class="checkbox-input" id="${id}" name="${name}"${checked ? ' checked' : ''}><span class="checkbox-box" aria-hidden="true"></span><span class="checkbox-label">${label}</span></label>`;
}

function kebab(triggerLabel, items, triggerClass = '') {
    const menuItems = items.map(i => `<button class="kebab-item${i.danger ? ' kebab-item-danger' : ''}" onclick="${i.onclick}">${i.icon ? `<span>${i.icon}</span>` : ''}${i.label}</button>`).join('');
    return `<div class="kebab${triggerClass}"><button class="kebab-trigger" aria-label="${triggerLabel}" aria-expanded="false" aria-haspopup="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button><div class="kebab-menu" role="menu">${menuItems}</div></div>`;
}

// =============================================================================
// RENDER: ORG (Estructura del ecosistema)
// =============================================================================

export function renderOrg(data) {
    if (!data || !data.org) return alertBox('warning', 'Sin datos', 'No hay datos de estructura disponibles.');

    const { agents, worktrees, crons, remotes, paths, mcp, alerts } = data.org;

    let html = '';

    // KPIs
    const kpis = [
        { label: 'Agentes', value: agents?.length ?? 0, icon: '🤖' },
        { label: 'Worktrees', value: worktrees?.length ?? 0, icon: '🌳' },
        { label: 'Crons activos', value: crons?.filter(c => c.enabled).length ?? 0, icon: '⏰' },
        { label: 'Alertas', value: alerts?.length ?? 0, icon: '🚨' }
    ];
    html += `<div class="pulso-kpis">${kpis.map(k => `<div class="card"><div class="card-body" style="text-align:center"><div style="font-size:var(--text-3xl)">${k.icon}</div><div class="cell-mono" style="font-size:var(--text-2xl)">${k.value}</div><div style="font-size:var(--text-xs);color:var(--text-tertiary)">${k.label}</div></div></div>`).join('')}</div>`;

    // Agents grid
    if (agents?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Agentes</h4>`;
        html += `<div class="agent-grid">${agents.map(a => card(a.id, `<div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>Modelo:</strong> ${a.model}</div><div><strong>Heartbeat:</strong> ${a.heartbeat}</div><div><strong>Repo:</strong> ${a.repo}</div><div><strong>MCP:</strong> ${a.mcp?.enabled ? '✅' : '❌'}</div></div>`)).join('')}</div>`;
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

    // Crons
    if (crons?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Crons</h4>`;
        html += tableWrap(table(
            ['ID', 'Agente', 'Schedule', 'Próx. ejecución', 'Estado'],
            crons.map(c => ({
                cells: [
                    { html: `<code class="cell-mono">${c.id}</code>` },
                    { html: c.agent },
                    { html: `<code class="cell-mono">${c.schedule}</code>` },
                    { html: c.nextRun ? formatRelativeTime(c.nextRun) : '—' },
                    { html: c.enabled ? badge('success', 'Activo') : badge('neutral', 'Pausado') }
                ]
            }))
        ));
    }

    // Remotes
    if (remotes?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Remotes</h4>`;
        html += tableWrap(table(
            ['Nombre', 'URL', 'Tipo'],
            remotes.map(r => ({
                cells: [
                    { html: `<strong>${r.name}</strong>` },
                    { html: `<code class="cell-mono">${r.url}</code>` },
                    { html: badge(r.type === 'origin' ? 'info' : 'neutral', r.type) }
                ]
            }))
        ));
    }

    // Paths
    if (paths?.length) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">Paths del ecosistema</h4>`;
        html += tableWrap(table(
            ['Clave', 'Path', 'Existe'],
            paths.map(p => ({
                cells: [
                    { html: `<code class="cell-mono">${p.key}</code>` },
                    { html: `<code class="cell-mono">${p.path}</code>` },
                    { html: p.exists ? badge('success', 'Sí') : badge('danger', 'No') }
                ]
            }))
        ));
    }

    // MCP
    if (mcp) {
        html += `<h4 style="margin:var(--space-6) 0 var(--space-3)">MCP mi-repo-boveda</h4>`;
        html += `<div class="grid grid-2" style="font-size:var(--text-sm)"><div><strong>Directorios permitidos:</strong></div><div><pre class="cell-mono" style="max-height:200px;overflow:auto">${mcp.allowedDirs?.join('\n') || '—'}</pre></div><div><strong>Política:</strong></div><div><code class="cell-mono">${mcp.policy}</code></div></div>`;
    }

    return html;
}/**
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
}/**
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
}/**
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
}/**
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