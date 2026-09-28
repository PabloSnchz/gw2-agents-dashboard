/**
 * js/parser.js
 * Extrae KPIs estructurados del markdown de los 7 archivos.
 * Cada método devuelve datos estructurados; si el parsing falla,
 * devuelve { parseable: false } y el renderer hará fallback a marked.js.
 */

class DashboardParser {

    /**
     * Parsea TEAM_STATUS.md → estados de agentes + crons
     * KPIs: agent states (running/idle/timeout/ok), cron status
     */
    static parseTeamStatus(md) {
        const data = {
            parseable: true,
            agents: [],
            crons: [],
            overallStatus: 'ok',
            lastHeartbeat: null
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Extraer timestamp de actualización
        const tsMatch = md.match(/> Actualizado:?\s*(.+)/i);
        if (tsMatch) data.lastHeartbeat = tsMatch[1].trim();

        // Parsear "Tareas en curso" → estados de agentes
        const tareasSection = this._extractSection(md, 'Tareas en curso');
        if (tareasSection) {
            // Parseo line-by-line: más robusto que regex con lookahead (que fallaba
            // con $ + flag m en líneas intermedias)
            const agentLines = tareasSection.split('\n');
            let currentName = null;
            let currentDesc = '';

            for (const line of agentLines) {
                // Detectar línea de agente principal: "- **name:**"
                const agentMatch = line.match(/^(- )?\*\*([^*]+):\*\*/);
                if (agentMatch) {
                    // Guardar agente anterior
                    if (currentName) {
                        const desc = currentDesc.trim();
                        data.agents.push({
                            name: currentName,
                            desc: desc.substring(0, 200),
                            status: this._extractAgentStatus(desc)
                        });
                    }
                    // Iniciar nuevo agente
                    currentName = agentMatch[2].trim();
                    // Extraer descripción restante de la línea (después de ":**")
                    const afterColon = line.substring(agentMatch[0].length).trim();
                    currentDesc = afterColon;
                } else if (currentName && line.trim()) {
                    // Sub-bullet o continuación de descripción
                    currentDesc += '\n' + line;
                }
            }
            // Guardar último agente
            if (currentName) {
                const desc = currentDesc.trim();
                data.agents.push({
                    name: currentName,
                    desc: desc.substring(0, 200),
                    status: this._extractAgentStatus(desc)
                });
            }
        }

        // Parsear crons desde tabla
        const cronsSection = this._extractSection(md, 'Crons configurados');
        if (cronsSection) {
            const rows = this._parseTable(cronsSection);
            rows.forEach(row => {
                data.crons.push({
                    id: row[0]?.replace(/`/g, '') || '',
                    name: row[1]?.replace(/`/g, '') || '',
                    agent: row[2]?.replace(/`/g, '') || '',
                    schedule: row[3] || '',
                    timeout: row[4] || '',
                    state: row[5] || '',
                    lastRun: row[6] || ''
                });
            });
        }

        // Determinar estado general
        const statuses = data.agents.map(a => a.status);
        if (statuses.includes('timeout') || statuses.includes('error')) {
            data.overallStatus = 'warning';
        } else if (statuses.every(s => s === 'ok' || s === 'running')) {
            data.overallStatus = 'ok';
        } else {
            data.overallStatus = 'partial';
        }

        return data;
    }

    /**
     * Parsea ALERTS_LOG.md → alertas por severidad
     * KPIs: active count, critical/medium/low breakdown
     */
    static parseAlerts(md) {
        const data = {
            parseable: true,
            total: 0,
            active: 0,
            closed: 0,
            bySeverity: { critical: 0, medium: 0, low: 0 },
            bySeverityClosed: { critical: 0, medium: 0, low: 0 },
            details: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Alertas activas
        const activeSection = this._extractSection(md, 'Alertas activas');
        if (activeSection) {
            const rows = this._parseTable(activeSection);
            rows.forEach(row => {
                if (row.length >= 2) {
                    data.active++;
                    data.total++;
                    const severity = row[1] || '';
                    const level = this._parseSeverity(severity);
                    if (level) data.bySeverity[level]++;
                    data.details.push({
                        severity: severity.replace(/[`]/g, ''),
                        description: row[2]?.replace(/[`]/g, '') || '',
                        agent: row[3]?.replace(/[`]/g, '') || '',
                        state: row[4]?.replace(/[`]/g, '') || ''
                    });
                }
            });
        }

        // Alertas cerradas (últimas 7 días)
        const closedSection = this._extractSection(md, 'Alertas cerradas');
        if (closedSection) {
            const rows = this._parseTable(closedSection);
            data.closed = Math.max(0, rows.length - 1); // -1 por header
        }

        return data;
    }

    /**
     * Parsea COMMS_LOG.md → comunicaciones pendientes
     * KPIs: pending count, in-progress count, timeout count
     */
    static parseComms(md) {
        const data = {
            parseable: true,
            total: 0,
            pending: 0,
            inProgress: 0,
            timeout: 0,
            details: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        const activeSection = this._extractSection(md, 'Comunicaciones activas');
        if (activeSection) {
            const rows = this._parseTable(activeSection);
            rows.forEach(row => {
                if (row.length >= 5) {
                    data.total++;
                    const state = row[4] || '';
                    if (/⏳|Esperando/.test(state)) data.pending++;
                    if (/🔁|progreso/i.test(state)) data.inProgress++;
                    if (/⏱|timeout/i.test(state)) data.timeout++;
                    data.details.push({
                        from: row[1]?.replace(/[`]/g, '') || '',
                        to: row[2]?.replace(/[`]/g, '') || '',
                        request: row[3]?.replace(/"/g, '') || '',
                        state: state.replace(/[`]/g, '')
                    });
                }
            });
        }

        return data;
    }

    /**
     * Parsea COMMS_LOG.md → comunicaciones detalladas (activas + cerradas)
     * KPIs: total, active, closed, pending, timeouts, resolved
     *
     * Modelo de datos:
     *   { id, from, to, summary, status, statusLabel,
     *     created, updated, sourceSection }
     * status: 'pending' | 'timeout' | 'resolved' | 'inProgress' | 'error' | 'unknown'
     */
    static parseCommunications(md) {
        const data = {
            parseable: true,
            total: 0,
            active: 0,
            closed: 0,
            pending: 0,
            inProgress: 0,
            timeout: 0,
            resolved: 0,
            details: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Parsear "Comunicaciones activas"
        const activeSection = this._extractSection(md, 'Comunicaciones activas');
        if (activeSection) {
            const rows = this._parseTable(activeSection);
            rows.forEach(row => {
                if (row.length >= 5) {
                    data.total++;
                    data.active++;
                    const state = row[4] || '';
                    const parsed = this._parseCommStatus(state);
                    data.details.push({
                        id: 'comm-' + data.total,
                        from: this._cleanCell(row[1]),
                        to: this._cleanCell(row[2]),
                        summary: this._cleanCell(row[3], true),
                        status: parsed.status,
                        statusLabel: parsed.label,
                        created: this._cleanCell(row[5]),
                        updated: this._cleanCell(row[6]),
                        sourceSection: 'activas'
                    });
                    if (parsed.status === 'pending') data.pending++;
                    if (parsed.status === 'inProgress') data.inProgress++;
                    if (parsed.status === 'timeout') data.timeout++;
                }
            });
        }

        // Parsear "Comunicaciones cerradas (últimas 24h)"
        const closedSection = this._extractSection(md, 'Comunicaciones cerradas');
        if (closedSection) {
            const rows = this._parseTable(closedSection);
            rows.forEach(row => {
                if (row.length >= 5) {
                    data.total++;
                    data.closed++;
                    const result = row[4] || '';
                    const parsed = this._parseCommStatus(result);
                    data.details.push({
                        id: 'comm-' + data.total,
                        from: this._cleanCell(row[1]),
                        to: this._cleanCell(row[2]),
                        summary: this._cleanCell(row[3], true),
                        status: parsed.status,
                        statusLabel: parsed.label,
                        created: this._cleanCell(row[5]),
                        closed: this._cleanCell(row[6]),
                        sourceSection: 'cerradas'
                    });
                    if (parsed.status === 'resolved') data.resolved++;
                    if (parsed.status === 'timeout') data.timeout++;
                }
            });
        }

        return data;
    }

    /** Limpia una celda de tabla: remueve backticks y comillas, opcional truncado */
    static _cleanCell(cell, truncate = false) {
        if (!cell) return '';
        let cleaned = cell.replace(/[`]/g, '').trim();
        if (truncate) cleaned = cleaned.substring(0, 200);
        return cleaned;
    }

    /** Parsea el estado de una comunicación (emoji → status enum + label) */
    static _parseCommStatus(text) {
        if (/⏳|esperando/i.test(text)) return { status: 'pending', label: 'Esperando' };
        if (/⏱|timeout/i.test(text)) return { status: 'timeout', label: 'Timeout' };
        if (/consumido|completad/i.test(text)) return { status: 'resolved', label: 'Consumido' };
        if (/✅/.test(text)) return { status: 'resolved', label: 'Respondido' };
        if (/🔄|en progreso/i.test(text)) return { status: 'inProgress', label: 'En progreso' };
        if (/❌|fallid/i.test(text)) return { status: 'error', label: 'Fallido' };
        return { status: 'unknown', label: 'Desconocido' };
    }

    /**
     * Parsea SESSION_LOG.md → sesiones recientes + decisiones
     * KPIs: session count, last activity
     */
    static parseSessionLog(md) {
        const data = {
            parseable: true,
            sessionCount: 0,
            lastActivity: null,
            completedTasks: 0,
            pendingTasks: 0
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Contar headers (##) como sesiones
        const headers = md.match(/^## .+/gm);
        data.sessionCount = headers ? headers.length : 0;

        // Extraer última actividad
        const tsMatch = md.match(/> Actualizado:?\s*(.+)/i) ||
                       md.match(/> \[.*?\]:\s*(\d{4}-\S+)/i);
        if (tsMatch) data.lastActivity = tsMatch[1].trim();

        // Contar tareas completadas/pendientes (emojis)
        const okMatches = md.match(/✅/g);
        const pendingMatches = md.match(/⏳|⏱|🔄/g);
        data.completedTasks = okMatches ? okMatches.length : 0;
        data.pendingTasks = pendingMatches ? pendingMatches.length : 0;

        return data;
    }

    // --- Util ---

    /**
     * Extrae el contenido de una sección (## Heading) hasta el siguiente ##.
     * FIX: usa ^## con flag m para no confundirse con sub-secciones ### y
     * no depender de lookahead frágil (que cortaba el contenido antes de tiempo).
     */
    static _extractSection(md, heading) {
        // Buscar la línea que empieza con "## heading" (case-insensitive)
        const startRegex = new RegExp(`^##\\s+${heading}[^\\n]*\\n`, 'im');
        const startMatch = md.match(startRegex);
        if (!startMatch) return null;

        const startIdx = startMatch.index + startMatch[0].length;
        const rest = md.substring(startIdx);

        // Buscar el próximo "## " al inicio de línea
        const endMatch = rest.match(/^##\s/m);
        const sectionContent = endMatch ? rest.substring(0, endMatch.index) : rest;

        return sectionContent;
    }

    /** Parsea una tabla markdown → array de arrays (sin header ni separador) */
    static _parseTable(text) {
        const lines = text.split('\n').filter(l => l.trim());
        // Encontrar la línea del header de tabla
        const headerIdx = lines.findIndex(l => l.includes('|') && l.match(/\|[-:| ]+\|/));
        if (headerIdx === -1) return [];

        const dataLines = lines.slice(headerIdx + 1).filter(l =>
            l.startsWith('|') && !l.match(/\|[-:| ]+\|/) && l.trim() !== ''
        );

        return dataLines.map(line => {
            const cols = line.split('|').slice(1, -1).map(c => c.trim());
            return cols;
        }).filter(row => row.length > 0);
    }

    /** Extrae estado de agente de descripción */
    static _extractAgentStatus(desc) {
        if (/⏱|timeout/i.test(desc)) return 'timeout';
        if (!/✅/.test(desc) && /⏱|timed? ?out/i.test(desc)) return 'timeout';
        if (/✅/.test(desc) && !/⏱|timeout/i.test(desc)) return 'ok';
        if (/🔄/.test(desc)) return 'running';
        if (/⏳|⏸/.test(desc)) return 'idle';
        if (/❌|error/i.test(desc)) return 'error';
        if (/CRÍTICO|🔴/.test(desc)) return 'error';
        return 'unknown';
    }

    /** Parsea severidad de alerta */
    static _parseSeverity(text) {
        const normalized = text.toLowerCase();
        if (/🔴|alta|critical/i.test(normalized)) return 'critical';
        if (/🟡|media|medium/i.test(normalized)) return 'medium';
        if (/🟢|baja|low/i.test(normalized)) return 'low';
        return null;
    }

    /**
     * Parsea CRON_SCHEDULE.md → crons, tareas en curso, bloqueadas, últimos resultados.
     */
    static parseCronSchedule(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            nextUpdate: null,
            crons: [],
            descriptions: {},
            inProgress: [],
            blocked: [],
            lastResults: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Timestamps del header
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();
        const nextMatch = md.match(/>\s*Próxima actualización esperada:\s*(.+)/i);
        if (nextMatch) data.nextUpdate = nextMatch[1].trim();

        // Parsear "Crons activos"
        const cronsSection = this._extractSection(md, 'Crons activos');
        if (cronsSection) {
            const rows = this._parseTable(cronsSection);
            rows.forEach(row => {
                data.crons.push({
                    id: this._cleanCell(row[0]),
                    name: this._cleanCell(row[1]),
                    agent: this._cleanCell(row[2]),
                    schedule: this._cleanCell(row[3]),
                    every: this._cleanCell(row[4]),
                    timeout: this._cleanCell(row[5]),
                    state: this._cleanCell(row[6])
                });
            });
        }

        // Parsear "Descripciones" — bloques: **Nombre**\nDescripción
        const descSection = this._extractSection(md, 'Descripciones');
        if (descSection) {
            const blocks = descSection.split(/\n(?=\*\*)/);
            blocks.forEach(block => {
                const match = block.match(/^\*\*([^*]+)\*\*\s*\n([\s\S]+)/);
                if (match) {
                    data.descriptions[match[1].trim()] = match[2].trim().replace(/\n+/g, ' ');
                }
            });
        }

        // Parsear "Tareas en curso"
        const inProgressSection = this._extractSection(md, 'Tareas en curso');
        if (inProgressSection) {
            const rows = this._parseTable(inProgressSection);
            rows.forEach(row => {
                data.inProgress.push({
                    agent: this._cleanCell(row[0]),
                    task: this._cleanCell(row[1]),
                    started: this._cleanCell(row[2]),
                    eta: this._cleanCell(row[3]),
                    state: this._cleanCell(row[4])
                });
            });
        }

        // Parsear "Tareas bloqueadas"
        const blockedSection = this._extractSection(md, 'Tareas bloqueadas');
        if (blockedSection) {
            const rows = this._parseTable(blockedSection);
            rows.forEach(row => {
                data.blocked.push({
                    task: this._cleanCell(row[0]),
                    blockedBy: this._cleanCell(row[1]),
                    unblocker: this._cleanCell(row[2]),
                    notes: this._cleanCell(row[3])
                });
            });
        }

        // Parsear "Últimos resultados de crons"
        const resultsSection = this._extractSection(md, 'Últimos resultados de crons');
        if (resultsSection) {
            const rows = this._parseTable(resultsSection);
            rows.forEach(row => {
                data.lastResults.push({
                    cron: this._cleanCell(row[0]),
                    lastRun: this._cleanCell(row[1]),
                    result: this._cleanCell(row[2]),
                    commit: this._cleanCell(row[3])
                });
            });
        }

        return data;
    }

    /**
     * Parsea DASHBOARD_PO_IDEAS.md → top prioridades + pospuestas.
     */
    static parsePoIdeas(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            topPriorities: [],
            postponed: [],
            metadata: {}
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        // Parsear "Top prioridades"
        const topSection = this._extractSection(md, 'Top prioridades');
        if (topSection) {
            const rows = this._parseTable(topSection);
            rows.forEach(row => {
                data.topPriorities.push({
                    rank: this._cleanCell(row[0]),
                    idea: this._cleanCell(row[1]),
                    difficulty: this._cleanCell(row[2]),
                    state: this._cleanCell(row[3]),
                    eta: this._cleanCell(row[4])
                });
            });
        }

        // Parsear "Ideas pospuestas"
        const postponedSection = this._extractSection(md, 'Ideas pospuestas');
        if (postponedSection) {
            const rows = this._parseTable(postponedSection);
            rows.forEach(row => {
                data.postponed.push({
                    rank: this._cleanCell(row[0]),
                    idea: this._cleanCell(row[1]),
                    reason: this._cleanCell(row[2])
                });
            });
        }

        // Parsear "Metadatos"
        const metaSection = this._extractSection(md, 'Metadatos');
        if (metaSection) {
            const lines = metaSection.split('\n');
            lines.forEach(line => {
                const m = line.match(/^[-*]\s*([^:]+):\s*(.+)$/);
                if (m) {
                    data.metadata[m[1].trim()] = m[2].trim();
                }
            });
        }

        return data;
    }
}
