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
            const agentRegex = /\*\*([^*]+):\*\*\s*([\s\S]*?)(?=\n\*\*|\n- |\n\n)/g;
            let match;
            while ((match = agentRegex.exec(tareasSection)) !== null) {
                const name = match[1].trim();
                const desc = match[2].trim().substring(0, 200);
                const status = this._extractAgentStatus(desc);
                data.agents.push({ name, desc, status });
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

    /** Extrae el contenido de una sección (## Heading) hasta el siguiente ## */
    static _extractSection(md, heading) {
        const pattern = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|\\n\\n##|\\n$)`, 'i');
        const match = md.match(pattern);
        return match ? match[1] : null;
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
}
