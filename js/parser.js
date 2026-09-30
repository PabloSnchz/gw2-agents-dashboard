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

        // Parsear "Estado de tareas" o "Tareas en curso" → estados de agentes
        const tareasSection = this._extractSection(md, 'Estado de tareas') 
                            || this._extractSection(md, 'Tareas en curso');
        if (tareasSection) {
            const agentLines = tareasSection.split('\n');
            let currentName = null;
            let currentDesc = '';

            for (const line of agentLines) {
                // Formato nuevo: "    default (Principal): ..." o "    product-owner: ..."
                // Formato viejo: "- **Nombre:** ..."
                let newName = null;
                let afterColon = '';

                // Intento 1: formato nuevo con "(Label)"
                let m = line.match(/^\s{2,8}([a-z][a-z0-9_-]+)\s*\(([^)]+)\):\s*(.*)$/i);
                if (m) {
                    newName = `${m[1].trim()} (${m[2].trim()})`;
                    afterColon = m[3].trim();
                } else {
                    // Intento 2: formato nuevo sin label "    product-owner:"
                    m = line.match(/^\s{2,8}([a-z][a-z0-9_-]+):\s*(.*)$/i);
                    if (m && !line.match(/^\s*-\s/)) {
                        newName = m[1].trim();
                        afterColon = m[2].trim();
                    } else {
                        // Intento 3: formato viejo "- **Nombre:**"
                        m = line.match(/^(- )?\*\*([^*]+):\*\*/);
                        if (m) {
                            newName = m[2].trim();
                            afterColon = line.substring(m[0].length).trim();
                        }
                    }
                }

                if (newName) {
                    if (currentName) {
                        const fullDesc = currentDesc.trim();
                        const firstLine = fullDesc.split('\n')[0];
                        data.agents.push({
                            name: currentName,
                            desc: fullDesc.substring(0, 200),
                            status: this._extractAgentStatus(firstLine)
                        });
                    }
                    currentName = newName;
                    currentDesc = afterColon;
                } else if (currentName && line.trim()) {
                    currentDesc += '\n' + line;
                }
            }

            if (currentName) {
                const fullDesc = currentDesc.trim();
                const firstLine = fullDesc.split('\n')[0];
                data.agents.push({
                    name: currentName,
                    desc: fullDesc.substring(0, 200),
                    status: this._extractAgentStatus(firstLine)
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

        // Alertas activas.
        //
        // FIX: se lee por NOMBRE de columna, no por posición. ALERTS_LOG.md
        // mezcla una tabla de 6 columnas y otra de 8. Con índices fijos la
        // descripción caía en el campo `agent`, y live-status usaba ese campo
        // para decidir que un agente estaba CAÍDO: bastaba con que su nombre
        // apareciera en el texto de cualquier alerta para marcarlo rojo.
        const activeSection = this._extractSection(md, 'Alertas activas');
        if (activeSection) {
            this._alertTables(activeSection).forEach(t => {
                t.rows.forEach(row => {
                    if (row.length < 2) return;
                    data.active++;
                    data.total++;
                    const severity = this._cell(row, t.cols.severity);
                    const level = this._parseSeverity(severity);
                    if (level) data.bySeverity[level]++;
                    data.details.push({
                        id: this._cell(row, t.cols.id),
                        severity: this._cleanCell(severity),
                        type: this._cleanCell(this._cell(row, t.cols.type)),
                        description: this._cleanCell(this._cell(row, t.cols.description)),
                        state: this._cleanCell(this._cell(row, t.cols.state)),
                        resolution: this._cleanCell(this._cell(row, t.cols.resolution)),
                        detected: this._cell(row, t.cols.detectado),
                        // ALERTS_LOG.md no tiene columna de agente: el nombre
                        // aparece dentro del texto de la descripción. Se deja
                        // vacío a propósito. Antes iba la descripción entera
                        // acá, y eso era indistinguible de "este agente falló".
                        agent: ''
                    });
                });
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
            byImportance: { critical: 0, important: 0, routine: 0, unclassified: 0 },
            avgResponseTimeMs: 0,
            criticalPending: 0,
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
                    // Detectar formato nuevo (12+ cols) vs viejo (8 cols)
                    const isNewFormat = row.length >= 12;
                    const importance = isNewFormat ? this._cleanCell(row[5]) : '';
                    const type = isNewFormat ? this._cleanCell(row[6]) : '';
                    const attempt = isNewFormat ? this._cleanCell(row[7]) : '1';
                    const taskId = isNewFormat ? this._cleanCell(row[8]) : this._cleanCell(row[5]);
                    const created = isNewFormat ? this._cleanCell(row[9]) : this._cleanCell(row[5]);
                    const updated = isNewFormat ? this._cleanCell(row[10]) : this._cleanCell(row[6]);
                    const duration = isNewFormat ? this._cleanCell(row[11]) : '';

                    data.details.push({
                        id: 'comm-' + data.total,
                        from: this._cleanCell(row[1]),
                        to: this._cleanCell(row[2]),
                        summary: this._cleanCell(row[3], true),
                        status: parsed.status,
                        statusLabel: parsed.label,
                        importance: importance,
                        importanceKey: this._parseImportance(importance),
                        type: type,
                        attempt: attempt,
                        taskId: taskId,
                        created: created,
                        updated: updated,
                        duration: duration,
                        sourceSection: 'activas'
                    });
                    if (parsed.status === 'pending') data.pending++;
                    if (parsed.status === 'inProgress') data.inProgress++;
                    if (parsed.status === 'timeout') data.timeout++;

                    const impKey = this._parseImportance(importance);
                    if (data.byImportance[impKey] !== undefined) data.byImportance[impKey]++;
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
                    const isNewFormat = row.length >= 12;
                    const importance = isNewFormat ? this._cleanCell(row[5]) : '';
                    const type = isNewFormat ? this._cleanCell(row[6]) : '';
                    const attempt = isNewFormat ? this._cleanCell(row[7]) : '1';
                    const taskId = isNewFormat ? this._cleanCell(row[8]) : this._cleanCell(row[5]);
                    const created = isNewFormat ? this._cleanCell(row[9]) : this._cleanCell(row[5]);
                    const closed = isNewFormat ? this._cleanCell(row[10]) : this._cleanCell(row[6]);
                    const duration = isNewFormat ? this._cleanCell(row[11]) : '';

                    data.details.push({
                        id: 'comm-' + data.total,
                        from: this._cleanCell(row[1]),
                        to: this._cleanCell(row[2]),
                        summary: this._cleanCell(row[3], true),
                        status: parsed.status,
                        statusLabel: parsed.label,
                        importance: importance,
                        importanceKey: this._parseImportance(importance),
                        type: type,
                        attempt: attempt,
                        taskId: taskId,
                        created: created,
                        closed: closed,
                        duration: duration,
                        sourceSection: 'cerradas'
                    });
                    if (parsed.status === 'resolved') data.resolved++;
                    if (parsed.status === 'timeout') data.timeout++;

                    const impKey = this._parseImportance(importance);
                    if (data.byImportance[impKey] !== undefined) data.byImportance[impKey]++;
                }
            });
        }

        // Tiempo promedio de respuesta (solo cerradas con duración válida)
        const durations = data.details
            .filter(d => d.duration && d.duration !== '' && d.duration !== '—')
            .map(d => this._parseDurationMs(d.duration))
            .filter(ms => ms > 0);
        if (durations.length > 0) {
            data.avgResponseTimeMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        }

        // Críticas pendientes
        data.criticalPending = data.details.filter(d =>
            d.importanceKey === 'critical' &&
            ['pending', 'inProgress', 'timeout'].includes(d.status)
        ).length;

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

    /**
     * Parsea ORG_MAP.md → mapa organizacional del ecosistema (tab Estructura).
     * 7 secciones + pendientes de verificación.
     * Si el formato del .md cambia, devuelve parseable:false y el renderer
     * cae a marked.js (mismo contrato que el resto de los parsers).
     */
    static parseOrgMap(md) {
        const data = {
            parseable: true,
            verifiedAt: null,
            preamble: [],
            agents: [],
            agentNotes: [],
            interactions: [],
            reviewerBug: null,
            filePerms: [],
            filePermsRules: [],
            repoPerms: [],
            remotes: [],
            refspec: null,
            worktrees: null,
            configPerms: [],
            enforcement: { real: [], honor: [] },
            chats: [],
            notifications: [],
            commsNotes: [],
            rules: { promotion: [], autonomy: [], fallbacks: [], transversales: [] },
            pending: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Fecha de verificación contra el código real
        const tsMatch = md.match(/>\s*Verificado contra el código real el\s*(.+)/i);
        if (tsMatch) data.verifiedAt = tsMatch[1].trim().replace(/\.$/, '');

        // Blockquotes del header (contexto del documento)
        const header = md.split(/^##\s/m)[0];
        data.preamble = (header.match(/^>.*$/gm) || [])
            .map(l => l.replace(/^>\s?/, '').trim())
            .filter(l => l.length > 0);

        // --- §1 Agentes y roles ---
        const sec1 = this._extractSection(md, '1. Agentes y roles');
        if (sec1) {
            this._parseTable(sec1).forEach(row => {
                if (row.length >= 5) {
                    data.agents.push({
                        name: this._cleanCell(row[0]),
                        id: this._cleanCell(row[1]),
                        role: this._cleanCell(row[2]),
                        heartbeat: this._cleanCell(row[3]),
                        status: this._cleanCell(row[4])
                    });
                }
            });
            sec1.split('\n').forEach(line => {
                const m = line.match(/^Nota\s+(\d+):\s*(.+)/);
                if (m) data.agentNotes.push({ number: m[1], text: m[2].trim() });
            });
        }

        // --- §2 Interacciones entre agentes ---
        const sec2 = this._extractSection(md, '2. Interacciones entre agentes');
        if (sec2) {
            this._parseTable(sec2).forEach(row => {
                if (row.length >= 5) {
                    data.interactions.push({
                        from: this._cleanCell(row[0]),
                        to: this._cleanCell(row[1]),
                        channel: this._cleanCell(row[2]),
                        purpose: this._cleanCell(row[3]),
                        state: this._cleanCell(row[4])
                    });
                }
            });

            const bug = this._extractSubsection(sec2, 'Bug del Reviewer y workarounds');
            if (bug) {
                // Descripción = todo lo que no es un item numerado
                const desc = bug.split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !/^#/.test(l) && !/^\d+\.\s/.test(l))
                    .join(' ');
                data.reviewerBug = {
                    description: desc,
                    workarounds: this._numberedList(bug)
                };
            }
        }

        // --- §3 Permisos de escritura (archivos) ---
        const sec3 = this._extractSection(md, '3. Permisos de escritura');
        if (sec3) {
            this._parseTable(this._primaryTable(sec3)).forEach(row => {
                if (row.length >= 3) {
                    data.filePerms.push({
                        file: this._cleanCell(row[0]),
                        writer: this._cleanCell(row[1]),
                        reader: this._cleanCell(row[2])
                    });
                }
            });
            data.filePermsRules = this._bulletsAfter(sec3, 'Reglas transversales de escritura');
        }

        // --- §4 Permisos de escritura (repos) ---
        const sec4 = this._extractSection(md, '4. Permisos de escritura');
        if (sec4) {
            this._parseTable(this._primaryTable(sec4)).forEach(row => {
                if (row.length >= 3) {
                    data.repoPerms.push({
                        repo: this._cleanCell(row[0]),
                        push: this._cleanCell(row[1]),
                        reader: this._cleanCell(row[2]),
                        excluded: this._cleanCell(row[3])
                    });
                }
            });

            const remotesSec = this._extractSubsection(sec4, 'Los 3 repos y sus remotes');
            if (remotesSec) {
                this._parseTable(remotesSec).forEach(row => {
                    if (row.length >= 3) {
                        data.remotes.push({
                            path: this._cleanCell(row[0]),
                            remotes: this._cleanCell(row[1]),
                            note: this._cleanCell(row[2])
                        });
                    }
                });
            }

            const refspecSec = this._extractSubsection(sec4, 'Refspec de push');
            if (refspecSec) data.refspec = this._paragraph(refspecSec);

            const wtSec = this._extractSubsection(sec4, 'Worktrees');
            if (wtSec) data.worktrees = this._paragraph(wtSec);
        }

        // --- §5 Permisos de configuración ---
        const sec5 = this._extractSection(md, '5. Permisos de configuración');
        if (sec5) {
            this._parseTable(sec5).forEach(row => {
                if (row.length >= 3) {
                    data.configPerms.push({
                        resource: this._cleanCell(row[0]),
                        who: this._cleanCell(row[1]),
                        enforcement: this._cleanCell(row[2])
                    });
                }
            });

            const enf = this._extractSubsection(sec5, 'Enforcement real vs regla de honor');
            if (enf) {
                const realM = enf.match(/\*\*Enforcement real\*\*[^\n]*\n([\s\S]*?)(?=\*\*Regla de honor\*\*|$)/i);
                const honorM = enf.match(/\*\*Regla de honor\*\*[^\n]*\n([\s\S]*?)$/i);
                if (realM) data.enforcement.real = this._bullets(realM[1]);
                if (honorM) data.enforcement.honor = this._bullets(honorM[1]);
            }
        }

        // --- §6 Comunicación con Pablo ---
        const sec6 = this._extractSection(md, '6. Comunicación con Pablo');
        if (sec6) {
            this._parseTables(sec6).forEach(table => {
                if (!table.length) return;
                if (table[0].length >= 4) {
                    table.forEach(row => {
                        data.chats.push({
                            chat: this._cleanCell(row[0]),
                            agent: this._cleanCell(row[1]),
                            session: this._cleanCell(row[2]),
                            purpose: this._cleanCell(row[3])
                        });
                    });
                } else if (table[0].length === 3) {
                    table.forEach(row => {
                        data.notifications.push({
                            sender: this._cleanCell(row[0]),
                            how: this._cleanCell(row[1]),
                            purpose: this._cleanCell(row[2])
                        });
                    });
                }
            });
            // Notas de cierre: párrafos que no son tabla, lista ni heading.
            // El párrafo del canal habilitado se excluye: el renderer ya lo muestra.
            data.commsNotes = sec6.split(/\n\s*\n/)
                .map(block => block.split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('|') && !l.startsWith('#')
                                 && !/^[-*]\s/.test(l) && !/^-{3,}$/.test(l))
                    .join(' '))
                .map(p => p.trim())
                .filter(p => p.length > 0 && !/^Único canal/i.test(p));
        }

        // --- §7 Excepciones y reglas de oro ---
        const sec7 = this._extractSection(md, '7. Excepciones y reglas de oro');
        if (sec7) {
            const promo = this._extractSubsection(sec7, '7.1 Promoción a');
            if (promo) data.rules.promotion = this._numberedList(promo);

            const auto = this._extractSubsection(sec7, '7.2 Autonomía');
            if (auto) data.rules.autonomy = this._bullets(auto);

            const fb = this._extractSubsection(sec7, '7.3 Fallbacks');
            if (fb) {
                this._parseTable(fb).forEach(row => {
                    if (row.length >= 2) {
                        data.rules.fallbacks.push({
                            situation: this._cleanCell(row[0]),
                            rule: this._cleanCell(row[1])
                        });
                    }
                });
            }

            const trans = this._extractSubsection(sec7, '7.4 Otras reglas de oro');
            if (trans) data.rules.transversales = this._bullets(trans);
        }

        // --- Pendientes de verificación ---
        // Items numerados con continuación indentada: se agrupan por item,
        // no por línea (si no, el detail queda cortado en la primera coma).
        const pend = this._extractSection(md, 'Pendientes de verificación');
        if (pend) {
            const items = [];
            let current = null;
            pend.split('\n').forEach(raw => {
                const line = raw.trim();
                if (!line) return;
                const head = line.match(/^\d+\.\s+(.+)$/);
                if (head) {
                    if (current) items.push(current);
                    current = head[1];
                } else if (current) {
                    current += ' ' + line;
                }
            });
            if (current) items.push(current);

            items.forEach(text => {
                const bold = text.match(/^\*\*(.+?)\*\*\s*:?\s*([\s\S]*)$/);
                data.pending.push({
                    title: bold ? this._cleanCell(bold[1]) : this._shorten(text, 60),
                    detail: bold ? bold[2].trim() : text
                });
            });
        }

        // Si no se encontró nada parseable → el renderer cae a marked.js
        const found = data.agents.length > 0 || data.interactions.length > 0
                   || data.repoPerms.length > 0 || data.configPerms.length > 0;
        if (!found) data.parseable = false;

        return data;
    }

    // --- Util ---

    /**
     * Devuelve solo la parte de la sección anterior a su primera subsección
     * (###). Necesario porque _parseTable() seguiría leyendo las tablas de las
     * subsecciones y las mezclaría con la tabla principal.
     */
    static _primaryTable(sectionText) {
        if (!sectionText) return '';
        const cut = sectionText.search(/^###\s/m);
        return cut === -1 ? sectionText : sectionText.substring(0, cut);
    }

    /**
     * Extrae una subsección (### Heading) dentro de un texto ya acotado,
     * hasta el próximo heading (## o ###).
     */
    static _extractSubsection(text, heading) {
        if (!text || typeof text !== 'string') return null;
        const startRegex = new RegExp(`^###\\s+${heading}[^\\n]*\\n`, 'im');
        const startMatch = text.match(startRegex);
        if (!startMatch) return null;

        const rest = text.substring(startMatch.index + startMatch[0].length);
        const endMatch = rest.match(/^#{2,3}\s/m);
        return endMatch ? rest.substring(0, endMatch.index) : rest;
    }

    /**
     * Parsea TODAS las tablas markdown de un texto → array de tablas,
     * cada una = array de filas (array de celdas). A diferencia de
     * _parseTable(), que solo devuelve la primera.
     */
    static _parseTables(text) {
        const tables = [];
        let current = null;

        text.split('\n').forEach(raw => {
            const line = raw.trim();
            // Línea separadora '|---|---|' → arranca una tabla nueva
            if (/^\|[-:| ]+\|$/.test(line)) {
                current = [];
                tables.push(current);
                return;
            }
            if (current && line.startsWith('|') && line.length > 1) {
                const cols = line.split('|').slice(1, -1).map(c => c.trim());
                if (cols.length) current.push(cols);
            } else if (current && line === '') {
                current = null;
            }
        });

        return tables;
    }

    /**
     * Lista con guiones ('- ') → array de strings, sin el prefijo.
     * Soporta envoltura suave: las líneas indentadas son continuación del bullet.
     */
    static _bullets(text) {
        if (!text) return [];
        const items = [];
        text.split('\n').forEach(raw => {
            const m = raw.match(/^\s*[-*]\s+(.+)$/);
            if (m) {
                items.push(m[1].trim());
            } else if (items.length && raw.trim() && /^\s{2,}/.test(raw) && !raw.trim().startsWith('#')) {
                items[items.length - 1] += ' ' + raw.trim();
            }
        });
        return items.filter(l => l.length > 0);
    }

    /** Bullets que siguen a un label en línea (ej. 'Reglas transversales de escritura:') */
    static _bulletsAfter(text, label) {
        if (!text || !label) return [];
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idx = text.search(new RegExp('^.*' + escaped, 'im'));
        if (idx === -1) return [];
        const lineEnd = text.indexOf('\n', idx);
        return this._bullets(lineEnd === -1 ? '' : text.substring(lineEnd + 1));
    }

    /**
     * Lista numerada ('1. ') → array de strings, sin el prefijo.
     * Soporta envoltura suave igual que _bullets().
     */
    static _numberedList(text) {
        if (!text) return [];
        const items = [];
        text.split('\n').forEach(raw => {
            const m = raw.match(/^\s*\d+\.\s+(.+)$/);
            if (m) {
                items.push(m[1].trim());
            } else if (items.length && raw.trim() && /^\s{2,}/.test(raw) && !raw.trim().startsWith('#')) {
                items[items.length - 1] += ' ' + raw.trim();
            }
        });
        return items.filter(l => l.length > 0);
    }

    /** Parrafo de texto plano: une líneas, quita viñetas y separadores '---' */
    static _paragraph(text) {
        if (!text) return '';
        return text.split('\n')
            .map(l => l.replace(/^\s*[-*]\s+/, '').trim())
            .filter(l => l.length > 0 && !/^\\?-{3,}$/.test(l))
            .join(' ');
    }

    /** Recorta un string a N caracteres con elipsis */
    static _shorten(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '...' : str;
    }

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

    /**
     * Igual que _parseTables(), pero conserva el header de cada tabla.
     * Es lo que hace falta en ALERTS_LOG.md, que mezcla dos formatos:
     * Una tabla de 6 columnas (# | Severidad | Tipo | Descripción | Estado |
     * Resolución) y otra de 8 (... | Detectado | Última actualización).
     */
    static _parseTablesWithHeader(text) {
        const tables = [];
        let pending = null;
        let current = null;

        String(text).split('\n').forEach(raw => {
            const line = raw.trim();
            if (/^\|[-:| ]+\|$/.test(line)) {
                current = { header: pending || [], rows: [] };
                tables.push(current);
                pending = null;
                return;
            }
            if (line.startsWith('|') && line.length > 1) {
                const cols = line.split('|').slice(1, -1).map(c => c.trim());
                if (current) current.rows.push(cols);
                else pending = cols;
            } else if (line === '') {
                current = null;
                pending = null;
            }
        });

        return tables;
    }

    /**
     * Tablas de alertas de un texto, con las columnas YA resueltas por nombre.
     * Devuelve [{ cols: {severity: 1, ...}, rows: [[...]] }]. Descarta toda
     * tabla que no tenga 'Severidad' y 'Descripción': antes no hacía falta
     * distinguir, porque se leían posiciones fijas.
     */
    static _alertTables(text) {
        return this._parseTablesWithHeader(text)
            .map(t => {
                const cols = t.header.map(h =>
                    h.toLowerCase().replace(/[`*]/g, '').replace(/\s+/g, ' ').trim()
                );
                const idx = re => cols.findIndex(c => re.test(c));
                return {
                    cols: {
                        id:          idx(/^(#|id)$/),
                        severity:    idx(/^severidad$/),
                        type:        idx(/^tipo$/),
                        description: idx(/^descripci/),
                        state:       idx(/^estado$/),
                        resolution:  idx(/^resoluci/),
                        detectado:   idx(/^(detectado|fecha)/)
                    },
                    rows: t.rows
                };
            })
            .filter(t => t.cols.severity !== -1 && t.cols.description !== -1);
    }

    /** Celda por índice de columna mapeada. Columna ausente (-1) → '' */
    static _cell(row, idx) {
        return (idx >= 0 && idx < row.length) ? (row[idx] || '') : '';
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
        if (!desc) return 'unknown';

        // Timeout explícito
        if (/TIMEOUT|timed?\s*out|⏱/i.test(desc)) return 'timeout';

        // Error explícito
        if (/❌|\(error\)|\berror:/i.test(desc)) return 'error';

        // Éxito explícito (✅ o palabras de completado)
        if (/✅|ejecutado|completad|done|resuelt/i.test(desc)) return 'ok';

        // En progreso
        if (/🔄|en progreso|running/i.test(desc)) return 'running';

        // Idle
        if (/⏳|⏸/.test(desc)) return 'idle';

        // Sin marcadores
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

    /**
     * Parsea TEAM_STATUS.md buscando escalados a Pablo.
     * Retorna un array de items con severidad "critical".
     */
    static parseEscalations(md) {
        const items = [];
        if (!md || typeof md !== 'string') return items;

        const lines = md.split('\n');
        lines.forEach(line => {
            // Ignorar líneas de tabla markdown (empiezan con |)
            if (line.trim().startsWith('|')) return;

            // "ESCALADO a Pablo" (con o sin markdown bold)
            if (/ESCALADO a Pablo/i.test(line)) {
                let clean = line
                    .replace(/\*+/g, '')
                    .replace(/^\s*[-*🚨⚠️\d.]+\s*/, '')          // guiones, emojis, números al inicio
                    .replace(/^\d+\.\s*/, '')                     // numeración "1. "
                    .replace(/^ESCALADO a Pablo[.:]?\s*/i, '')    // prefijo redundante
                    .replace(/^🚨\s*/, '')                        // emoji extra
                    .trim();

                if (clean.length > 15) {
                    items.push({
                        severity: 'critical',
                        title: 'Escalado a Pablo',
                        detail: clean.substring(0, 250),
                        action: 'Requiere tu decisión'
                    });
                }
            }
            // "Requires Pablo" (no duplicar si ya matcheó ESCALADO)
            else if (/Requires Pablo/i.test(line)) {
                let clean = line
                    .replace(/\*+/g, '')
                    .replace(/^\s*[-*🚨⚠️\d.]+\s*/, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();

                if (clean.length > 15) {
                    items.push({
                        severity: 'critical',
                        title: 'Requiere OK de Pablo',
                        detail: clean.substring(0, 250),
                        action: 'Requiere tu decisión'
                    });
                }
            }
        });

        // Deduplicar por detail
        const seen = new Set();
        return items.filter(i => {
            if (seen.has(i.detail)) return false;
            seen.add(i.detail);
            return true;
        });
    }

    /**
     * Parsea READY_FOR_PROMOTION.md → items listos para promover.
     */
    static parseReadyForPromotion(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            items: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        const section = this._extractSection(md, 'Listos para promover');
        if (section) {
            const rows = this._parseTable(section);
            rows.forEach(row => {
                data.items.push({
                    item: this._cleanCell(row[0]),
                    branch: this._cleanCell(row[1]),
                    commits: this._cleanCell(row[2]),
                    date: this._cleanCell(row[3]),
                    description: this._cleanCell(row[4])
                });
            });
        }

        return data;
    }

    /**
     * Parsea IN_PROGRESS.md → ramas activas.
     */
    static parseInProgress(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            branches: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        const section = this._extractSection(md, 'Ramas activas');
        if (section) {
            const rows = this._parseTable(section);
            rows.forEach(row => {
                data.branches.push({
                    branch: this._cleanCell(row[0]),
                    item: this._cleanCell(row[1]),
                    started: this._cleanCell(row[2]),
                    state: this._cleanCell(row[3]),
                    notes: this._cleanCell(row[4])
                });
            });
        }

        return data;
    }

    /**
     * Parsea la importancia de una comm (emoji → key interno).
     */
    /**
     * Parsea "1h 15min" o "45min" o "2h" → milisegundos.
     */
    static _parseDurationMs(str) {
        if (!str) return 0;
        let ms = 0;
        const hMatch = str.match(/(\d+)\s*h/i);
        const mMatch = str.match(/(\d+)\s*m(?:in)?/i);
        if (hMatch) ms += parseInt(hMatch[1], 10) * 3600000;
        if (mMatch) ms += parseInt(mMatch[1], 10) * 60000;
        return ms;
    }

    static _parseImportance(text) {
        if (!text) return 'unclassified';
        const t = text.toLowerCase();
        if (/🔴|crítica|critica|critical/.test(t)) return 'critical';
        if (/🟡|importante|important/.test(t)) return 'important';
        if (/🟢|rutinaria|routine/.test(t)) return 'routine';
        return 'unclassified';
    }

    /**
     * Parsea COMMS_DETAILS.md → conversación completa de cada comm.
     * Estructura: ## comm-NNN + bloques (📤 PEDIDO / 📥 RESPUESTA / 🔄 REINTENTO / ✅ CONSUMO).
     */
    static parseCommsDetails(md) {
        const data = {
            parseable: true,
            conversations: {}
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Dividir por "## comm-" (cada conversación)
        const parts = md.split(/^## (comm-\d+)/gm);
        // parts = ["...intro...", "comm-001", "...content...", "comm-002", "...content...", ...]

        for (let i = 1; i < parts.length; i += 2) {
            const commId = parts[i].trim();
            const content = parts[i + 1] || '';

            const conv = {
                id: commId,
                meta: {},
                blocks: []
            };

            // Parsear metadata (líneas tipo "- Campo: valor")
            const metaLines = content.match(/^-\s*([^:]+):\s*(.+)$/gm) || [];
            metaLines.forEach(line => {
                const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
                if (m) conv.meta[m[1].trim()] = m[2].trim();
            });

            // Parsear bloques (### título + cita)
            const blockRegex = /^###\s+(.+?)(?:\s+\(([^)]+)\))?\s*\n+>\s*([\s\S]*?)(?=\n###|\n*$)/gm;
            let bMatch;
            while ((bMatch = blockRegex.exec(content)) !== null) {
                const title = bMatch[1].trim();
                const author = bMatch[2] ? bMatch[2].trim() : '';
                const text = bMatch[3].trim().replace(/^>\s*/gm, '').trim();

                conv.blocks.push({
                    title: title,
                    author: author,
                    text: text
                });
            }

            data.conversations[commId] = conv;
        }

        return data;
    }

    /**
     * Parsea PROMOTIONS.md → feats pendientes de decisión de Pablo +
     * decisiones ya tomadas (tab "Promociones").
     *
     * Robusto a cambios de formato: NO asume nombres de columna ni de
     * sección, y NO busca el estado en toda la fila (eso produce falsos
     * positivos con frases como "No revertir ni modificar"). El estado se
     * lee del primer término en negrita de la fila —que es la convención
     * del archivo— y solo si falta se busca en el texto con límites de
     * palabra.
     */
    static parsePromotions(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            pending: [],
            decisions: []
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Primera fecha ISO del documento como "actualizado"
        const d = md.match(/\d{4}-\d{2}-\d{2}/);
        if (d) data.updatedAt = d[0];

        // Partir por "## " en vez de usar _extractSection() con un nombre
        // fijo: así sigue funcionando si el Principal renombra la sección.
        const sections = md.split(/^##\s+/m).slice(1);
        let foundSections = false;

        sections.forEach(section => {
            const nl = section.indexOf('\n');
            const title = (nl === -1 ? section : section.substring(0, nl)).trim();
            const body = nl === -1 ? '' : section.substring(nl + 1);

            const isPending = /pendient|esperando|por decidir|revisar/i.test(title);
            const isDecision = /decision|tomadas|historial|aprobad/i.test(title);
            if (!isPending && !isDecision) return;

            foundSections = true;
            const target = isPending ? data.pending : data.decisions;
            const rows = this._parseTable(body);

            if (rows.length) {
                rows.forEach(row => {
                    const item = this._promoRow(row);
                    if (item) target.push(item);
                });
            } else {
                // Sin tabla: bullets ('- `1234567` — feat: PENDIENTE')
                this._bullets(body).forEach(b => {
                    const item = this._promoRow([b]);
                    if (item) target.push(item);
                });
            }
        });

        // Si no se reconoce ninguna sección → el renderer cae a marked.js
        if (!foundSections) data.parseable = false;

        return data;
    }

    /**
     * Convierte una fila de PROMOTIONS.md → { date, commit, feat, state, raw }.
     * Acepta un array de celdas (tabla) o un string suelto (bullet).
     */
    static _promoRow(cells) {
        const raw = (Array.isArray(cells) ? cells.join(' — ') : String(cells)).trim();
        if (!raw) return null;

        // SHA de 7-40 hex entre backticks
        const sha = raw.match(/`([0-9a-f]{7,40})`/i);
        const commit = sha ? sha[1].substring(0, 7) : null;

        // Fecha ISO
        const dm = raw.match(/\d{4}-\d{2}-\d{2}/);
        const date = dm ? dm[0] : null;

        // Estado: primero el término en negrita (convención del archivo)
        const bold = raw.match(/\*\*([^*]+)\*\*/);
        const probe = bold ? bold[1] : raw;
        let state = 'unknown';

        if (/pendient|esperando|por decidir/i.test(probe)) state = 'pending';
        else if (/revertid|rechazad|descartad|sacad/i.test(probe)) state = 'reverted';
        else if (/autorizad|aprobad|promovid/i.test(probe)) state = 'authorized';
        else if (/listo para probar/i.test(probe)) state = 'ready';
        else if (/probado|testeado/i.test(probe)) state = 'tested';
        else {
            // Fallback con límites de palabra: 'revertir' (verbo) NO cuenta
            // como revertido, 'revertido' (participio) sí.
            const t = raw.toLowerCase();
            if (/\bpendientes?\b/.test(t)) state = 'pending';
            else if (/\brevertid[oa]s?\b|\brechazad[oa]s?\b/.test(t)) state = 'reverted';
            else if (/\bautorizad[oa]s?\b/.test(t)) state = 'authorized';
            else if (/\blisto para probar\b/.test(t)) state = 'ready';
            else if (/\bprobad[oa]s?\b/.test(t)) state = 'tested';
        }

        // Feat: la fila sin SHA, sin fecha, sin markdown ni separadores
        const feat = this._cleanCell(
            raw
                .replace(/`[0-9a-f]{7,40}`/gi, '')
                .replace(/\d{4}-\d{2}-\d{2}/g, '')
                .replace(/\*+/g, '')
                .replace(/[|—–]/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim()
        );

        if (!feat && !commit) return null;
        return { date, commit, feat: feat || '(sin descripción)', state, raw };
    }
}
