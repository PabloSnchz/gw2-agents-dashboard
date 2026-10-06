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

                    // "??" no es información: 1 fila de 27 (ALERT-60) tiene el
                    // emoji escrito como "??" en el archivo. Verificado a nivel
                    // de bytes (3f 3f), o sea es basura de escritura, no un
                    // problema de decodificación. Se quita para que no se vea
                    // "🟢 ?? Baja". Si al quitarlo no queda nada, se deja la
                    // celda como estaba: convertir un dato roto en un vacío
                    // sería peor que mostrarlo.
                    const sevRaw = this._cell(row, t.cols.severity);
                    let severity = this._cleanCell(sevRaw).replace(/[?¿]+/g, '').replace(/\s+/g, ' ').trim();
                    if (!severity) severity = this._cleanCell(sevRaw);

                    const level = this._parseSeverity(severity);
                    if (level) data.bySeverity[level]++;
                    data.details.push({
                        id: this._cell(row, t.cols.id),
                        severity,
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
            branches: [],
            closedThisCycle: []
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
                const branch = this._cleanCell(row[0]);
                const item = this._cleanCell(row[1]);
                const started = this._cleanCell(row[2]);
                const state = this._cleanCell(row[3]);
                const notes = this._cleanCell(row[4]);

                // La fila de encabezado se cuela como dato si la tabla trae
                // titulo con negrita o el parser no descarta el separador.
                const esEncabezado = /^(rama|item|estado|notas|iniciada)$/i.test(branch)
                    || /^Rama\s*\(/i.test(branch)
                    || (branch === 'Item' && /Estado/i.test(state || ''));

                data.branches.push({
                    branch: branch,
                    item: item,
                    started: started,
                    state: state,
                    notes: notes,
                    // Clasificacion de VIDA, deducida del texto que escribe el
                    // equipo. IN_PROGRESS.md dice en su propia regla 3 que
                    // "cuando una rama se descarta, se elimina de esta lista",
                    // y no se cumple: de 9 filas solo 4 estan vivas. Mostrar
                    // una rama mergeada como "en curso" es un item fantasma.
                    vivo: esEncabezado ? false : this._ramaViva(state, notes, started),
                    esFilaEncabezado: esEncabezado,
                    // ¿Esperando una decision de Pablo? La pregunta se extrae
                    // con las palabras del equipo, no redactedada por mi.
                    decision: esEncabezado ? null : this._detectaDecision(`${state} ${notes}`),
                    fila: data.branches.length + 1
                });
            });
        }

        // La tabla "Cerradas en este ciclo" tambien trae items que esperan a
        // Pablo (el P3/cacheClear vive ahi). Sin esto, el bloque "necesita tu
        // decision" perderia la mitad de lo que hay que decidir.
        //
        // OJO: NO usar _extractSection() aca. Esa pide "^##\s+", y esta
        // seccion del archivo real es "### Cerradas en este ciclo" — tras los
        // dos "#" viene un "#", no un espacio, asi que no matchea y la tabla
        // entera pasaba inadvertida. Se extrae con su propio patron porque
        // _extractSection distingue a proposito ## de ### y otros callers
        // dependen de esa diferencia.
        const cerradas = this._extractHeadingAny(md, 'Cerradas en este ciclo');
        if (cerradas) {
            const rows = this._parseTable(cerradas);
            rows.forEach(row => {
                const branch = this._cleanCell(row[0]);
                const item = this._cleanCell(row[1]);
                const commits = this._cleanCell(row[2]);
                const state = this._cleanCell(row[3]);
                const esEncabezado = /^(rama|item|commits|estado)$/i.test(branch)
                    || (branch === 'Item' && /Estado/i.test(state || ''));
                if (esEncabezado) return;
                data.closedThisCycle.push({
                    branch: branch,
                    item: item,
                    commits: commits,
                    state: state,
                    decision: this._detectaDecision(`${state}`),
                    vivo: { viva: false, motivo: 'terminada' }
                });
            });
        }

        return data;
    }

    /**
     * Extrae una seccion por heading aceptando ## o ###.
     *
     * A diferencia de _extractSection (que distingue a proposito), esta
     * matchea cualquiera de los dos niveles. Existe porque "Cerradas en este
     * ciclo" esta en ### en IN_PROGRESS.md real, y con _extractSection la
     * tabla — y el item de cacheClear que espera a Pablo — no se veian.
     */
    static _extractHeadingAny(md, heading) {
        if (!md) return null;
        // ########## heading ... hasta el proximo heading de nivel <= al que hallamos
        const start = new RegExp(`^(#{2,3})\\s+${heading}[^\\n]*\\n`, 'im').exec(md);
        if (!start) return null;
        const nivel = start[1].length;
        const from = start.index + start[0].length;
        const rest = md.slice(from);
        const end = new RegExp(`^#{2,${nivel}}\\s`, 'im').exec(rest);
        return end ? rest.slice(0, end.index) : rest;
    }

    /**
     * Detecta si un item espera una DECISION DE PABLO y devuelve la frase
     * exacta para pegarle en el chat.
     *
     * Solo marca si el texto del equipo nombra la espera. No invento la
     * pregunta: si la encuentra, devuelve la oracion tal cual, porque la
     * pegable tiene que ser la del equipo, no una mia.
     *
     * Marcadores observados en los archivos reales (IN_PROGRESS.md,
     * ALERTS_LOG.md, DECISIONS_LOG.md). Se evita "bloquead" a secas: casi
     * todo esta bloqueado por algo tecnico y eso NO es decision de Pablo.
     */
    static _detectaDecision(texto) {
        if (!texto) return null;
        // El Markdown del equipo viene con **, ` y pipes. La pegable se
        // muestra en un modal como texto plano, no se re-renderiza: sin
        // limpiar, el usuario lee "** El boton de cacheClear NO esta aca: **P3**".
        const t = String(texto).replace(/\s+/g, ' ');

        // Marcadores FUERTES: la decision es de Pablo por dicho explicito.
        const fuertes = [
            /queda la decisi[oó]n de ([^.;|]+)/i,
            /decisi[oó]n de (Pablo|ALERT-\d+|ALERTA-\d+)/i,
            /esperando (?:a |tu )?Pablo/i,
            /requiere (?:tu |la )?decisi[oó]n (?:de Pablo )?/i,
            /falta (?:tu |la )?decisi[oó]n/i
        ];
        for (const re of fuertes) {
            const m = t.match(re);
            // El motivo se muestra en el panel, la pegable en el boton: los
            // dos van como texto plano, asi que los dos se limpian. El
            // motivo sin limpiar dejaba "** El boton de cacheClear NO esta
            // aca: **P3**" — el ** de apertura caia antes de la palabra y
            // el de cierre despues, dejando asteriscos colgados.
            if (m) return { motivo: this._limpiaMarkdown(m[0]), pregunta: this._oracionCon(t, m[0]) };
        }

        // Marcadores MEDIOS: falta algo que solo Pablo puede dar (un icono, un
        // si/no sobre una feature). "falta el icono X" es decision de Pablo;
        // "falta el endpoint" no lo es, asi que exigimos que el objeto falte
        // sea un asset/decision, no tecnica.
        if (/falta (?:el |la )?icono\b/i.test(t) || /falta (?:el |la )?asset\b/i.test(t)) {
            const m = t.match(/falta (?:el |la )?(?:icono|asset)[^.;|]*/i);
            if (m) return { motivo: this._limpiaMarkdown(m[0]), pregunta: this._oracionCon(t, m[0]) };
        }
        if (/\blo (?:que )?bloquea\b/i.test(t)) {
            const m = t.match(/[^.;|]*\blo (?:que )?bloquea\b[^.;|]*/i);
            if (m) return { motivo: this._limpiaMarkdown(m[0]), pregunta: this._oracionCon(t, m[0]) };
        }
        if (/\bsi (?:queremos|queres|quiere|queres|podemos)\b/i.test(t)) {
            const m = t.match(/[^.;|]*\bsi (?:queremos|queres|quiere|podemos)\b[^.;|]*/i);
            if (m) return { motivo: this._limpiaMarkdown(m[0]), pregunta: this._oracionCon(t, m[0]) };
        }

        return null;
    }

    /** Devuelve la oracion completa que contiene una frase, para que la
     *  pegable tenga contexto y no un fragmento sin sujeto. */    static _oracionCon(texto, fragmento) {
        const t = String(texto);
        const i = t.toLowerCase().indexOf(String(fragmento).toLowerCase());
        if (i === -1) return this._limpiaMarkdown(fragmento);
        // Corte en el punto/coma/semicolon/barra previo mas cercano.
        const previo = t.lastIndexOf('. ', i);
        const previo2 = t.lastIndexOf('; ', i);
        const previo3 = t.lastIndexOf('| ', i);
        const corte = Math.max(previo, previo2, previo3);
        const ini = corte === -1 ? 0 : corte + 2;
        // Buscar el cierre hacia adelante para no comerse la oracion siguiente.
        const fin1 = t.indexOf('. ', i);
        const fin2 = t.indexOf('; ', i);
        const fin3 = t.indexOf('| ', i);
        const fins = [fin1, fin2, fin3].filter(x => x !== -1);
        const fin = fins.length ? Math.min(...fins) : t.length;
        return this._limpiaMarkdown(t.slice(ini, fin).trim());
    }

    /** Quita el Markdown del equipo para mostrarlo como texto plano. */
    static _limpiaMarkdown(s) {
        return String(s == null ? '' : s)
            .replace(/\*\*/g, '')
            .replace(/`/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * ¿Esta rama realmente en curso?
     *
     * No pregunta "¿tiene texto?" sino "¿el texto dice que terminó?".
     * Un item que dice MERGEADO y borrada no es un item en curso, por muy
     * completo que parezca su fila.
     *
     * ⚠️ LA NEGACION ES EL TRAMPA. El archivo dice literalmente
     * "NO mergeada a `agents/main`" y "NO esta en main". Un match de
     * /mergead/ sin mirar la negacion clasifica como TERMINADA una rama que
     * sigue viva, y deja el panel en "0 en curso" con el ecosistema lleno de
     * trabajo. La primera version de esta funcion hizo exactamente eso: 9 de 9
     * filas muertas. Antes de buscar una palabra de "terminado", se anulan las
     * negaciones.
     *
     * Diferencia que NO se puede ignorar: "Commiteada y pusheada a
     * `agents/main`" = terminada. "Pusheada (316311d)" + "NO mergeada a
     * `agents/main`" = sigue viva, esperando Reviewer. Mismo verbo, opuesto
     * significado; los separa el destino.
     *
     * @returns {{viva: boolean, motivo: string|null}}
     */
    static _ramaViva(state, notes, started) {
        const crudo = `${state || ''} ${notes || ''}`;

        // 1) Anular negaciones ANTES de buscar palabras de "terminado".
        //    Cada patron se COME el destino opcional ("a `agents/main`"): si
        //    dejara el destino suelto, el check de "pusheada a agents/main" de
        //    abajo leeria "NO mergeada a `agents/main`" como si la rama HUBIERA
        //    ido a main, y mataria una rama que sigue viva. La negacion y su
        //    destino son una sola frase.
        const NEG_DESTINO = '(?:\\s+a\\s+`?agents/main`?)?';
        const t = crudo
            .replace(new RegExp('\\bno\\s+est[aa]\\s+en\\s+main' + NEG_DESTINO, 'gi'), '__NEG__')
            .replace(new RegExp('\\bno\\s+mergead[oa]s?' + NEG_DESTINO, 'gi'), '__NEG__')
            .replace(new RegExp('\\bno\\s+est[aa]\\s+referenciad[oa]s?' + NEG_DESTINO, 'gi'), '__NEG__')
            .replace(new RegExp('\\bno\\s+iniciad[oa]s?' + NEG_DESTINO, 'gi'), '__NEG__')
            .replace(/\bnunca\s+mergear\b/gi, '__NEG__');

        // 2) Encabezado de tabla colado como fila.
        if (/^Rama\s*\(/i.test(state || '')) return { viva: false, motivo: 'encabezado' };

        // 3) Redundante: el propio archivo dice que se puede borrar.
        if (/REDUNDANTE|se puede borrar/i.test(crudo)) {
            return { viva: false, motivo: 'redundante' };
        }

        // 4) Terminada con destino explicito. El destino es lo que separa
        //    "cerrada" de "esperando que la revisen".
        if (/\bCERRAD[OA]\b/i.test(t)) return { viva: false, motivo: 'terminada' };
        if (/\bMERGEAD[OA]\b/i.test(t) && !/__NEG__/.test(t)) {
            return { viva: false, motivo: 'terminada' };
        }
        // Pusheada A agents/main = terminada. Pusheada a su rama = viva.
        if (/\bpushead[oa]\b/i.test(t) && /a\s+`?agents\/main`?/i.test(t)) {
            return { viva: false, motivo: 'terminada' };
        }
        if (/\bcommitead[oa]\b/i.test(t) && /a\s+`?agents\/main`?/i.test(t)) {
            return { viva: false, motivo: 'terminada' };
        }

        // 5) Aprobada pero nunca empezada. "a crear" lo delata.
        if (/\(a crear\)|todav[ií]a\s+NO\s+iniciad/i.test(crudo)) {
            return { viva: false, motivo: 'no_iniciada' };
        }

        return { viva: true, motivo: null };
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
    /**
     * Parsea PROMOTIONS.md → lo que espera tu decisión, lo que está
     * explícitamente fuera, lo congelado, y el historial.
     *
     * POR QUÉ ESTE PARSER FUE REESCRITO (2026-09-30)
     *
     * Antes las filas se aplastaban en un solo string con " — " y el estado
     * se sacaba del PRIMER texto en negrita. Con la tabla real de
     * PROMOTIONS.md eso daba tres mentiras:
     *
     *   1. La tabla se titula "Por qué NO es candidato". El primer **...** de
     *      cada fila es "**0 callers.**" o "**Es código de test.**", que no es
     *      un estado. Resultado: state "unknown".
     *   2. Con state "unknown" los items caían en la sección de "Decisiones
     *      tomadas" por descarte, NO porque estuvieran decididos. Se mostraban
     *      como decisiones tomadas cosas que nadie decidió.
     *   3. El peor: 392c3b9 dice "**PENDIENTE**. No revertir ni modificar hasta
     *      instrucción de Pablo". El primer **...** es PENDIENTE, así que
     *      entraba en "Esperando tu decisión" con un badge de pendiente, que
     *      se lee como "dale que sí". La tab convertía un "no toques esto" en
     *      un "decidí esto".
     *
     * Arreglo de fondo: las columnas se identifican por NOMBRE de encabezado,
     * nunca por posición. Si el equipo agrega, saca o reordena columnas, el
     * parser sigue leyéndolas bien. Y hay un estado nuevo, "congelado", que
     * es el más importante de la tab y no existía.
     */
    static parsePromotions(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            esperando: [],      // espera una decisión de Pablo
            congelado: [],      // "no revertir ni modificar" → NO es decisión
            prodSinVerificar: [],  // YA en producción, sin confirmar que funcione
            noCandidato: [],    // explícitamente no es candidato a promoción
            indeterminado: [],  // no se pudo leer el estado; se dice, no se supone
            decidido: []        // historial de decisiones tomadas
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // La fecha sale de las FILAS, no de todo el documento.
        //
        // Antes tomaba la primera fecha del texto entero, y en un archivo que
        // explica en su prosa que el estado "EN PRODUCCIÓN, SIN VERIFICAR"
        // existe "desde el 2026-10-01", esa prosa le ganaba a los datos: la tab
        // decía "actualizado 2026-10-01" el mismo día que se registraba la
        // promoción del 2026-10-04. "Última actualización" tiene que ser el
        // dato más reciente que escribió el equipo, no una fecha citada de
        // pasada en un párrafo explicativo.
        const filas = md.split('\n').filter(l => l.trim().startsWith('|'));
        const dFecha = filas.join('\n').match(/\d{4}-\d{2}-\d{2}/);
        if (dFecha) data.updatedAt = dFecha[0];

        const sections = md.split(/^##\s+/m).slice(1);
        let foundSections = false;

        sections.forEach(section => {
            const nl = section.indexOf('\n');
            const title = (nl === -1 ? section : section.substring(0, nl)).trim();
            const body = nl === -1 ? '' : section.substring(nl + 1);

            // "decididas" tiene que ir antes que "decisión": /decisi/ matchea
            // "Decisiones tomadas" y las dos reglas se pisan.
            const isDecision = /decidid|tomadas|historial|aprobad/i.test(title);
            const isPending = !isDecision &&
                /pendient|esperando|por decidir|candidato|revisar/i.test(title);
            if (!isPending && !isDecision) return;

            foundSections = true;
            const tablas = this._parseTablesConHeader(body);

            if (tablas.length) {
                tablas.forEach(tabla => {
                    tabla.rows.forEach(row => {
                        const item = this._promoRowFila(tabla.header, row,
                                                        isDecision);
                        if (item) this._clasificarPromo(data, item, isDecision);
                    });
                });
            } else {
                this._bullets(body).forEach(b => {
                    const item = this._promoRowFila([], b, isDecision);
                    if (item) this._clasificarPromo(data, item, isDecision);
                });
            }
        });

        if (!foundSections) data.parseable = false;
        return data;
    }

    /**
     * Mete el item en su bucket. El orden importa: "congelado" se prueba
     * PRIMERO porque su texto suele decir también "pendiente" y ganaría el
     * primer partido si se probara después.
     */
    static _clasificarPromo(data, item, isDecision) {
        // Antes de la rama de decisiones, y antes que congelado.
        //
        // El item está en la tabla de "Decisiones tomadas" (isDecision), así
        // que sin esto caería en `congelado` por su "No revertir ni modificar
        // hasta que se verifique" — y quedaría pidiendo una decisión sobre algo
        // que ya está resuelto, que es el bug que esta tab ya tuvo una vez.
        // Lo que le falta no es la decisión: es la PRUEBA.
        if (item.prodSinVerificar) {
            data.prodSinVerificar.push(item);
            return;
        }
        if (isDecision) {
            // En el historial "PENDIENTE" no significa "esperando tu
            // decisión": significa "así quedó, sin resolver". 392c3b9 dice
            // "PENDIENTE. No revertir ni modificar hasta instrucción de Pablo":
            // eso NO es una tarea para vos, es un aviso de que hay que
            // dejarlo quieto. Va a su propio bucket con su propio cartel.
            //
            // En cambio 57008ae dice "AUTORIZADO en producción. No tocar.":
            // también dice "no tocar", pero la decisión YA está tomada, así
            // que va al historial con la nota de "no tocar" al lado. Meterlo
            // en "congelado" lo haría parecer que falta algo por decidir.
            if (item.congelado && !item.decidido) {
                data.congelado.push(item);
            } else {
                data.decidido.push(item);
            }
            return;
        }

        if (item.prodSinVerificar) { data.prodSinVerificar.push(item); return; }
            if (item.congelado) { data.congelado.push(item); return; }
        if (item.noCandidato) { data.noCandidato.push(item); return; }
        if (item.state === 'pending' || item.state === 'ready') {
            data.esperando.push(item);
            return;
        }
        // Sin estado legible NO se inventa uno. Va a su propio bucket para que
        // la tab lo muestre como "no se pudo leer", no como si estuviera
        // resuelto. Antes caía en "decisiones tomadas" por descarte.
        data.indeterminado.push(item);
    }

    /**
     * Tabla con encabezado. A diferencia de _parseTable(), NO tira la fila
     * de encabezados: sin ella las columnas son anónimas y no hay forma de
     * saber cuál es cuál salvo por posición, que es exactamente el
     * supuesto que rompió todo lo anterior.
     */
    // Todas las tablas de un texto, con su encabezado.
    //
    // Antes esta función devolvía SÓLO la primera y cortaba al terminar.
    // Eso está bien para las tablas de una sola, pero la sección "Pendientes
    // de decisión" de PROMOTIONS.md tiene dos tablas separadas por prosa: la
    // primera con el único feat que sí espera tu decisión, y la segunda —
    // "Por qué NO es candidato" — con el resto. Con una sola tabla, el
    // segundo grupo no se leía NADA y sus filas desaparecían sin dejar rastro,
    // que es peor que mostrarlas mal: un item que no aparece no se puede
    // auditar.
    static _parseTablesConHeader(text) {
        const lines = text.split('\n');
        const split = l => l.trim().split('|').slice(1, -1).map(c => c.trim());
        const tablas = [];

        for (let i = 0; i < lines.length; i++) {
            const l = lines[i].trim();
            if (!(l.startsWith('|') && /\|[-:| ]+\|/.test(l))) continue;

            let headerIdx = i - 1;
            while (headerIdx >= 0 && !lines[headerIdx].trim().startsWith('|')) headerIdx--;
            if (headerIdx < 0) continue;

            const header = split(lines[headerIdx]);
            if (!header.length || !header.some(h => h && h.length)) continue;

            const rows = [];
            let j = i + 1;
            for (; j < lines.length; j++) {
                const r = lines[j].trim();
                if (!r || !r.startsWith('|')) break;
                if (/^\|[-:| ]+\|$/.test(r)) continue;
                rows.push(split(r));
            }
            tablas.push({ header, rows });
            i = j - 1;
        }
        return tablas;
    }

    /**
     * Convierte una fila con encabezado conocido → item. Busca cada campo por
     * el NOMBRE de su columna, con un orden de preferencia, así que agregar o
     * reordenar columnas no rompe nada. Las columnas que no aparecen valen
     * null y la tab lo dice: nunca inventa un valor.
     */
    static _promoRowFila(header, row, isDecision) {
        const celda = (re) => {
            if (!header || !header.length) return null;
            for (let i = 0; i < header.length; i++) {
                if (re.test(header[i] || '')) return (row[i] || '').trim();
            }
            return null;
        };

        const cFeat   = celda(/^feat|funcionalidad|^item|caracter/i);
        const cRama   = celda(/rama|branch/i);
        const cComm   = celda(/commit|sha|merge/i);
        const cFecha  = celda(/fecha|date/i);
        const cDec    = celda(/decisi|estado|autoriz/i);
        // La columna que antes se perdía. Es la razón por la que un item NO es
        // candidato, que es justo lo que hace falta para no molestarlo.
        const cMotivo = celda(/por qu|criterio|motivo|raz[oó]n|porque|nota/i);
        // La columna nueva, opcional: dónde probar el cambio en dev.
        const cRuta   = celda(/d[oó]nde verlo|ruta|ver en dev|pantalla|screen|deep.?link/i);

        // Que la columna se llame "Por qué NO es candidato" ES la señal de no
        // candidato, y estaba en el encabezado, que se descartaba. Sin esto el
        // motivo ("Es código de test") llegaba como texto suelto y el item
        // caía en "no se pudo leer". Con esto se lee lo que el equipo escribió
        // como título de la columna.
        let motivoHdr = null;
        if (header && header.length) {
            for (let i = 0; i < header.length; i++) {
                if (/por qu|criterio|motivo|raz[oó]n|porque|nota/i.test(header[i] || '')) {
                    motivoHdr = (header[i] || '').trim();
                    break;
                }
            }
        }
        const noCandidatoPorColumna =
            !!motivoHdr && /no es candid|no son candid|no candidata/i.test(motivoHdr);

        // Sin encabezado reconocible (o bullet suelto): cae al parseo viejo,
        // que al menos no rompe.
        if (!cFeat && !cRama && !cComm) return this._promoRow(row, isDecision);

        const todo = [cFeat, cRama, cComm, cDec, cMotivo, cRuta].filter(Boolean).join(' — ');
        const shas = (cComm || '').match(/[0-9a-f]{7,40}/gi) || [];

        return this._armarPromo({
            texto: cFeat || cRama || (shas[0] || ''),
            fecha: cFecha,
            commits: shas.map(s => s.substring(0, 7)),
            rama: cRama ? this._cleanCell(cRama) : null,
            detalle: cDec ? this._cleanCell(cDec) : null,
            motivo: cMotivo ? this._cleanCell(cMotivo) : null,
            ruta: cRuta ? this._promoRuta(cRuta) : null,
            noCandidatoPorColumna,
            raw: todo
        }, isDecision);
    }

    /**
     * Saca de una celda de ruta lo que de verdad es una ruta de la app.
     *
     * Se devuelve SIN el "#" inicial, que es el mismo formato que usa
     * data/rutas-dev.json ("/account/raids", no "#/account/raids"). Con los
     * dos formatos distintos, validar una ruta contra la lista real exige
     * normalizar en el render, y ahí es donde se cuelan los links rotos.
     * El "#" lo pone el render al armar la URL.
     */
    static _promoRuta(celda) {
        const txt = String(celda);
        const m = txt.match(/#?(\/[a-zA-Z0-9\-_/]*)/);
        if (!m) return null;
        const ruta = m[1].replace(/\/+$/, '');
        return ruta && ruta.length > 1 ? ruta : null;
    }

    /**
     * Parseo por texto sin encabezado (bullets, o tabla con formato
     * desconocido). Mantiene el comportamiento anterior como respaldo.
     */
    static _promoRow(cells, isDecision) {
        const raw = (Array.isArray(cells) ? cells.join(' — ') : String(cells)).trim();
        if (!raw) return null;
        return this._armarPromo({ texto: raw, raw: raw }, isDecision);
    }

    /**
     * Armado común: acá se decide el estado, el nombre del feature y la
     * separación nombre/detalle.
     */
    static _armarPromo(entrada, isDecision) {
        const raw = entrada.raw || entrada.texto || '';
        const texto = entrada.texto || raw;

        const shas = entrada.commits && entrada.commits.length
            ? entrada.commits
            : (raw.match(/[0-9a-f]{7,40}/gi) || []).map(s => s.substring(0, 7));
        const commit = shas[0] || null;

        const fecha = entrada.fecha
            || (raw.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null;

        // "congelado" se evalúa sobre TODO el texto de la fila, no sobre el
        // primer **...**. La razón: en 392c3b9 el primer término en negrita
        // es PENDIENTE, pero la frase que define el estado real es "No
        // revertir ni modificar hasta instrucción de Pablo", y está más
        // abajo. Mirar solo el primer bold es lo que produjo el bug.
        const congelado = !!(
            /no revertir|sin revertir|no modificar|sin modificar|no tocar|intocable|congelad|hasta instrucci|hasta que Pablo|no revertir ni/i.test(raw)
        );

        // "Está en producción pero nadie confirmó que funcione" (2026-10-01).
        //
        // Se evalúa ANTES que congelado y antes que el state, por una razón
        // concreta: la fila dice "No revertir ni modificar hasta que se
        // verifique", así que el regex de congelado la matchea y se la lleva.
        // Con el orden viejo, un item que YA está en producción se renderiza
        // como "congelado" — que es exactamente lo que dice la fila, pero
        // esconde lo único que le importa a Pablo: que falta probarlo.
        //
        // El patrón busca SOLO expresiones de duda: "sin verificar", "nadie lo
        // verificó", "todavía no se verificó". Deliberadamente NO matchea
        // "verificado": un "AUTORIZADO, verificado por Pablo" es lo contrario
        // de lo que representa este estado, y un regex que lo absorbiera
        // mandaría lo ya revisado al bloque de "falta probar".
        const prodSinVerificar = !!(
            /(?:sin|no)\s+verific|nadie\s+(?:lo|la|los|las)?\s*verific|no\s+se\s+pudo\s+verific|todav[ií]a\s+no\s+(?:se|lo|la)?\s*verific|queda\s+(?:por|pendiente)?\s*verificar|falta\s+verificar|(?:sin|nadie\s+)\s*confirm\w*/i.test(raw)
        );

        const noCandidato = !!entrada.noCandidatoPorColumna || !!(
            /no es candid|no son candidat|no candidata|excluido|excluida|descartad|0 callers|no aplica a promoci/i.test(raw)
        );

        // Estado: sale de la columna "Estado" si la tabla la tiene, y recien
        // si no del primer **...** de la fila.
        //
        // Por qué el orden importa y por qué esto estaba roto: el primer
        // negrita de la fila del botón de caché es el NOMBRE del feature
        // ("**Idea 50 completa — el botón de liberar caché**"), porque la
        // columna Feat viene antes que la columna Estado y la celda viene en
        // negrita. El estado real ("**LISTO.**") era el segundo. Con el
        // "primer negrita" el único item accionable de la tab caía en
        // "no se pudo leer" y nadie podía verlo.
        const primerBold = s => {
            const m = String(s || '').match(/\*\*([^*]+)\*\*/);
            return m ? m[1] : null;
        };
        const probe = primerBold(entrada.detalle) || primerBold(raw) || raw;
        let state = 'unknown';
        // prodSinVerificar va PRIMERO: si no, la frase "hasta que se verifique"
        // de la fila la manda a 'congelado', que es verdad pero no es lo que
        // hay que mostrar. Lo que hay que mostrar es que ya está en
        // producción y le falta la prueba.
        if (prodSinVerificar) state = 'prod_sin_verificar';
        else if (congelado) state = 'congelado';
        else if (noCandidato) state = 'no_candidato';
        // "LISTO." a secas es el estado real del botón de cacheClear. Las dos
        // reglas anteriores pedían "listo para probar" y caían en unknown, que
        // mandaba el único item accionable de la tab al bucket "no se pudo
        // leer". Se prueba el probe como palabra suelta, no la fila entera:
        // "listo" en la letra chica de otro texto no debe convertirlo en
        // candidato.
        else if (/^\W*listo\W*$/i.test(probe)) state = 'ready';
        else if (/pendient|esperando|por decidir/i.test(probe)) state = 'pending';
        else if (/listo para probar|probar|para tu prueba/i.test(probe)) state = 'ready';
        else if (/revertid|rechazad|descartad|sacad/i.test(probe)) state = 'reverted';
        else if (/autorizad|aprobad|promovid/i.test(probe)) state = 'authorized';
        else if (/probado|testeado/i.test(probe)) state = 'tested';

        // "¿Está esto ya decidido?" va aparte del estado, porque "congelado" y
        // "decidido" no se excluyen: 57008ae está autorizado Y dice "no
        // tocar", y 392c3b9 está pendiente Y dice "no revertir". Los dos
        // mentions "no tocar"; solo uno falta que se decida. Sin este campo,
        // el bucket "congelado" se llevaba también el que ya estaba resuelto.
        const decidido = /autorizad|aprobad|promovid|revertid|rechazad|descartad|sacad/i.test(probe);

        // Nombre del feature y detalle: NO se parte por el primer ":".
        //
        // El nombre real del botón es "Idea 50 completa — el botón de liberar
        // caché" y después viene un paréntesis largo que empieza con un ":"
        // ("(Tramos A-F: cacheClear con dryRun, ...)"). Partir por el primer
        // dos puntos cortaba el nombre a mitad de palabra y dejaba
        // "Idea 50 completa — el botón de liberar caché (Tramos A-F" como
        // título. Los dos puntos solo separan un detalle cuando están
        // FUERA del paréntesis.
        const { nombre, detalle: det, cola } = this._nombreYDetalle(texto);
        const detalle = entrada.detalle || det || null;

        if (!nombre && !commit) return null;

        return {
            fecha,
            commit,
            commits: shas,
            nombre: nombre || '(sin descripción)',
            detalle,
            cola,
            rama: entrada.rama || null,
            motivo: entrada.motivo || null,
            ruta: entrada.ruta || null,
            state,
            congelado,
            prodSinVerificar,
            decidido,
            noCandidato,
            raw
        };
    }

    /**
     * Separa nombre / detalle / cola sin cortar palabras.
     *
     *   "Idea 50 completa — el botón (Tramos A-F: cacheClear …)"
     *       → nombre "Idea 50 completa — el botón"
     *         cola   "Tramos A-F: cacheClear …"
     *
     *   "(Solitary Throne CM daily tracker): PENDIENTE. No revertir…"
     *       → nombre "Solitary Throne CM daily tracker"
     *         detalle "PENDIENTE. No revertir…"
     *
     * Los shas SOLO se quitan del principio. Si se limpian de todo el texto,
     * "revertido con `a1a53c4`" queda como "revertido con ." y el dashboard
     * muestra una frase rota. El sha va en su propio campo de todas formas.
     */
    static _nombreYDetalle(textoCrudo) {
        let txt = String(textoCrudo)
            .replace(/^(?:[`\s,]*[0-9a-f]{7,40}[`\s,–-]*)+/i, '')  // shas al inicio
            .replace(/^[-—–:.\s]+/, '')
            .trim();
        if (!txt) return { nombre: '', detalle: null, cola: null };

        // "(nombre): detalle"
        const abre = txt.match(/^\(([^)]*)\)\s*[:—–]\s*(.+)$/);
        if (abre && abre[1].trim().length >= 3) {
            return { nombre: abre[1].trim(), detalle: abre[2].trim(), cola: null };
        }

        // "nombre (cola larga)"  → la cola no es el detalle de una decisión,
        // es la letra chica del feature.
        const colaLarga = txt.match(/^([^(]{3,90}?)\s*\(([^)]{25,})\)\s*$/);
        if (colaLarga) {
            return { nombre: colaLarga[1].trim(), detalle: null,
                     cola: colaLarga[2].trim() };
        }

        // "(nombre)" solo
        const solo = txt.match(/^\(([^)]{3,90})\)\s*$/);
        if (solo) return { nombre: solo[1].trim(), detalle: null, cola: null };

        // "nombre: detalle" (dos puntos fuera de paréntesis)
        const punto = txt.match(/^([^:]{3,90}):\s*(.+)$/);
        if (punto) return { nombre: punto[1].trim(), detalle: punto[2].trim(), cola: null };

        return { nombre: txt, detalle: null, cola: null };
    }

    /**
     * Parsea PRE_BACKLOG.md → ideas en espera del PO.
     *
     * 2026-10-05. La tab [P] Pre-backlog existia en index.html con su
     * container #prebacklog-container pero ningún script la llenaba:
     * era una caja vacia con dos botones que no hacia nada. El parser
     * faltaba, y con el la informacion del PO nunca llegaba al panel.
     *
     * Formato esperado (el PO escribe estos .md con su heartbeat):
     *   ## Ideas
     *   | ID | Idea | Fuente | Estado | Observaciones |
     *   |----|------|--------|--------|---------------|
     *   | PB-01 | ... | Reddit | pendiente | ... |
     */
    static parsePreBacklog(md) {
        const data = { parseable: true, updatedAt: null, ideas: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        const section = this._extractSection(md, 'Ideas');
        if (section) {
            const rows = this._parseTable(section);
            rows.forEach(row => {
                data.ideas.push({
                    id: this._cleanCell(row[0]),
                    titulo: this._cleanCell(row[1]),
                    fuente: this._cleanCell(row[2]),
                    estado: this._cleanCell(row[3]),
                    observaciones: this._cleanCell(row[4])
                });
            });
        }
        return data;
    }

    /**
     * Parsea BACKLOG.md → tareas priorizadas.
     *
     * 2026-10-05. Mismo caso que parsePreBacklog: la tab [B] Backlog
     * tenia #backlog-container vacio. Este parser lee la tabla "Tareas
     * priorizadas" que escribe el Principal en cada heartbeat.
     */
    static parseBacklog(md) {
        const data = { parseable: true, updatedAt: null, tareas: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        const section = this._extractSection(md, 'Tareas priorizadas');
        if (section) {
            const rows = this._parseTable(section);
            rows.forEach(row => {
                data.tareas.push({
                    id: this._cleanCell(row[0]),
                    titulo: this._cleanCell(row[1]),
                    prioridad: this._cleanCell(row[2]),
                    estado: this._cleanCell(row[3]),
                    observaciones: this._cleanCell(row[4])
                });
            });
        }
        return data;
    }

    /**
     * Parsea FEATURES.md → features construidas por el equipo.
     *
     * 2026-10-05. La tab [D] Desarrollo tenia tres containers vacios
     * (clones / ramas / features). Los clones ya los llenaba git.json;
     * las ramas y las features faltaban. Este parser lee FEATURES.md,
     * que escribe el equipo al mergear a agents/main.
     *
     * Formato esperado (FEATURES.md, tabla principal):
     *   | ID | Feature | Estado | Archivos | Observaciones |
     *   |----|---------|--------|----------|---------------|
     *   | F-01 | ... | Activo | js/foo.js | ... |
     */
    static parseFeatures(md) {
        const data = { parseable: true, updatedAt: null, features: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        const tables = this._parseTables(md);
        let features = [];
        tables.forEach(tbl => {
            const rows = this._parseTable(tbl);
            rows.forEach(row => {
                if (row.length < 2) return;
                const id = this._cleanCell(row[0]);
                const nombre = this._cleanCell(row[1]);
                if (!id && !nombre) return;
                features.push({
                    id: id || '?',
                    nombre: nombre || id,
                    estado: row[2] ? this._cleanCell(row[2]) : 'pendiente',
                    archivos: row[3] ? this._cleanCell(row[3]).split(',').map(a => a.trim()).filter(Boolean) : [],
                    description: row[4] ? this._cleanCell(row[4]) : null,
                    sha: null
                });
            });
        });
        data.features = features;
        return data;
    }
}

