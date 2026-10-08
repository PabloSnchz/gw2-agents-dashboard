/**
 * js/parser.js
 * Extrae KPIs estructurados del markdown de los 7 archivos.
 * Cada mÃ©todo devuelve datos estructurados; si el parsing falla,
 * devuelve { parseable: false } y el renderer harÃ¡ fallback a marked.js.
 */

class DashboardParser {

    /**
     * Parsea TEAM_STATUS.md â†’ estados de agentes + crons
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

        // Extraer timestamp de actualizaciÃ³n
        const tsMatch = md.match(/> Actualizado:?\s*(.+)/i);
        if (tsMatch) data.lastHeartbeat = tsMatch[1].trim();

        // Parsear "Estado de tareas" o "Tareas en curso" â†’ estados de agentes
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
     * Parsea ALERTS_LOG.md â†’ alertas por severidad
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
        // FIX: se lee por NOMBRE de columna, no por posiciÃ³n. ALERTS_LOG.md
        // mezcla una tabla de 6 columnas y otra de 8. Con Ã­ndices fijos la
        // descripciÃ³n caÃ­a en el campo `agent`, y live-status usaba ese campo
        // para decidir que un agente estaba CAÃDO: bastaba con que su nombre
        // apareciera en el texto de cualquier alerta para marcarlo rojo.
        const activeSection = this._extractSection(md, 'Alertas activas');
        if (activeSection) {
            this._alertTables(activeSection).forEach(t => {
                t.rows.forEach(row => {
                    if (row.length < 2) return;
                    data.active++;
                    data.total++;

                    // "??" no es informaciÃ³n: 1 fila de 27 (ALERT-60) tiene el
                    // emoji escrito como "??" en el archivo. Verificado a nivel
                    // de bytes (3f 3f), o sea es basura de escritura, no un
                    // problema de decodificaciÃ³n. Se quita para que no se vea
                    // "ðŸŸ¢ ?? Baja". Si al quitarlo no queda nada, se deja la
                    // celda como estaba: convertir un dato roto en un vacÃ­o
                    // serÃ­a peor que mostrarlo.
                    const sevRaw = this._cell(row, t.cols.severity);
                    let severity = this._cleanCell(sevRaw).replace(/[?Â¿]+/g, '').replace(/\s+/g, ' ').trim();
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
                        // aparece dentro del texto de la descripciÃ³n. Se deja
                        // vacÃ­o a propÃ³sito. Antes iba la descripciÃ³n entera
                        // acÃ¡, y eso era indistinguible de "este agente fallÃ³".
                        agent: ''
                    });
                });
            });
        }

        // Alertas cerradas (Ãºltimas 7 dÃ­as)
        const closedSection = this._extractSection(md, 'Alertas cerradas');
        if (closedSection) {
            const rows = this._parseTable(closedSection);
            data.closed = Math.max(0, rows.length - 1); // -1 por header
        }

        return data;
    }

    /**
     * Parsea COMMS_LOG.md â†’ comunicaciones pendientes
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
                    if (/â³|Esperando/.test(state)) data.pending++;
                    if (/ðŸ”|progreso/i.test(state)) data.inProgress++;
                    if (/â±|timeout/i.test(state)) data.timeout++;
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
     * Parsea COMMS_LOG.md â†’ comunicaciones detalladas (activas + cerradas)
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

        // Parsear "Comunicaciones cerradas (Ãºltimas 24h)"
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

        // Tiempo promedio de respuesta (solo cerradas con duraciÃ³n vÃ¡lida)
        const durations = data.details
            .filter(d => d.duration && d.duration !== '' && d.duration !== 'â€”')
            .map(d => this._parseDurationMs(d.duration))
            .filter(ms => ms > 0);
        if (durations.length > 0) {
            data.avgResponseTimeMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        }

        // CrÃ­ticas pendientes
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

    /** Parsea el estado de una comunicaciÃ³n (emoji â†’ status enum + label) */
    static _parseCommStatus(text) {
        if (/â³|esperando/i.test(text)) return { status: 'pending', label: 'Esperando' };
        if (/â±|timeout/i.test(text)) return { status: 'timeout', label: 'Timeout' };
        if (/consumido|completad/i.test(text)) return { status: 'resolved', label: 'Consumido' };
        if (/âœ…/.test(text)) return { status: 'resolved', label: 'Respondido' };
        if (/ðŸ”„|en progreso/i.test(text)) return { status: 'inProgress', label: 'En progreso' };
        if (/âŒ|fallid/i.test(text)) return { status: 'error', label: 'Fallido' };
        return { status: 'unknown', label: 'Desconocido' };
    }

    /**
     * Parsea SESSION_LOG.md â†’ sesiones recientes + decisiones
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

        // Extraer Ãºltima actividad
        const tsMatch = md.match(/> Actualizado:?\s*(.+)/i) ||
                       md.match(/> \[.*?\]:\s*(\d{4}-\S+)/i);
        if (tsMatch) data.lastActivity = tsMatch[1].trim();

        // Contar tareas completadas/pendientes (emojis)
        const okMatches = md.match(/âœ…/g);
        const pendingMatches = md.match(/â³|â±|ðŸ”„/g);
        data.completedTasks = okMatches ? okMatches.length : 0;
        data.pendingTasks = pendingMatches ? pendingMatches.length : 0;

        return data;
    }

    /**
     * Parsea ORG_MAP.md â†’ mapa organizacional del ecosistema (tab Estructura).
     * 7 secciones + pendientes de verificaciÃ³n.
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

        // Fecha de verificaciÃ³n contra el cÃ³digo real
        const tsMatch = md.match(/>\s*Verificado contra el cÃ³digo real el\s*(.+)/i);
        if (tsMatch) data.verifiedAt = tsMatch[1].trim().replace(/\.$/, '');

        // Blockquotes del header (contexto del documento)
        const header = md.split(/^##\s/m)[0];
        data.preamble = (header.match(/^>.*$/gm) || [])
            .map(l => l.replace(/^>\s?/, '').trim())
            .filter(l => l.length > 0);

        // --- Â§1 Agentes y roles ---
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

        // --- Â§2 Interacciones entre agentes ---
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
                // DescripciÃ³n = todo lo que no es un item numerado
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

        // --- Â§3 Permisos de escritura (archivos) ---
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

        // --- Â§4 Permisos de escritura (repos) ---
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

        // --- Â§5 Permisos de configuraciÃ³n ---
        const sec5 = this._extractSection(md, '5. Permisos de configuraciÃ³n');
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

        // --- Â§6 ComunicaciÃ³n con Pablo ---
        const sec6 = this._extractSection(md, '6. ComunicaciÃ³n con Pablo');
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
            // Notas de cierre: pÃ¡rrafos que no son tabla, lista ni heading.
            // El pÃ¡rrafo del canal habilitado se excluye: el renderer ya lo muestra.
            data.commsNotes = sec6.split(/\n\s*\n/)
                .map(block => block.split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('|') && !l.startsWith('#')
                                 && !/^[-*]\s/.test(l) && !/^-{3,}$/.test(l))
                    .join(' '))
                .map(p => p.trim())
                .filter(p => p.length > 0 && !/^Ãšnico canal/i.test(p));
        }

        // --- Â§7 Excepciones y reglas de oro ---
        const sec7 = this._extractSection(md, '7. Excepciones y reglas de oro');
        if (sec7) {
            const promo = this._extractSubsection(sec7, '7.1 PromociÃ³n a');
            if (promo) data.rules.promotion = this._numberedList(promo);

            const auto = this._extractSubsection(sec7, '7.2 AutonomÃ­a');
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

        // --- Pendientes de verificaciÃ³n ---
        // Items numerados con continuaciÃ³n indentada: se agrupan por item,
        // no por lÃ­nea (si no, el detail queda cortado en la primera coma).
        const pend = this._extractSection(md, 'Pendientes de verificaciÃ³n');
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

        // Si no se encontrÃ³ nada parseable â†’ el renderer cae a marked.js
        const found = data.agents.length > 0 || data.interactions.length > 0
                   || data.repoPerms.length > 0 || data.configPerms.length > 0;
        if (!found) data.parseable = false;

        return data;
    }

    // --- Util ---

    /**
     * Devuelve solo la parte de la secciÃ³n anterior a su primera subsecciÃ³n
     * (###). Necesario porque _parseTable() seguirÃ­a leyendo las tablas de las
     * subsecciones y las mezclarÃ­a con la tabla principal.
     */
    static _primaryTable(sectionText) {
        if (!sectionText) return '';
        const cut = sectionText.search(/^###\s/m);
        return cut === -1 ? sectionText : sectionText.substring(0, cut);
    }

    /**
     * Extrae una subsecciÃ³n (### Heading) dentro de un texto ya acotado,
     * hasta el prÃ³ximo heading (## o ###).
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
     * Parsea TODAS las tablas markdown de un texto â†’ array de tablas,
     * cada una = array de filas (array de celdas). A diferencia de
     * _parseTable(), que solo devuelve la primera.
     */
    static _parseTables(text) {
        const tables = [];
        let current = null;

        if (!text || typeof text !== 'string') return tables;

        text.split('\n').forEach(raw => {
            const line = raw.trim();
            // LÃ­nea separadora '|---|---|' â†’ arranca una tabla nueva
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
     * Lista con guiones ('- ') â†’ array de strings, sin el prefijo.
     * Soporta envoltura suave: las lÃ­neas indentadas son continuaciÃ³n del bullet.
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

    /** Bullets que siguen a un label en lÃ­nea (ej. 'Reglas transversales de escritura:') */
    static _bulletsAfter(text, label) {
        if (!text || !label) return [];
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idx = text.search(new RegExp('^.*' + escaped, 'im'));
        if (idx === -1) return [];
        const lineEnd = text.indexOf('\n', idx);
        return this._bullets(lineEnd === -1 ? '' : text.substring(lineEnd + 1));
    }

    /**
     * Lista numerada ('1. ') â†’ array de strings, sin el prefijo.
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

    /** Parrafo de texto plano: une lÃ­neas, quita viÃ±etas y separadores '---' */
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
     * Extrae el contenido de una secciÃ³n (## Heading) hasta el siguiente ##.
     * FIX: usa ^## con flag m para no confundirse con sub-secciones ### y
     * no depender de lookahead frÃ¡gil (que cortaba el contenido antes de tiempo).
     */
    static _extractSection(md, heading) {
        // Buscar la lÃ­nea que empieza con "## heading" (case-insensitive)
        const startRegex = new RegExp(`^##\\s+${heading}[^\\n]*\\n`, 'im');
        const startMatch = md.match(startRegex);
        if (!startMatch) return null;

        const startIdx = startMatch.index + startMatch[0].length;
        const rest = md.substring(startIdx);

        // Buscar el prÃ³ximo "## " al inicio de lÃ­nea
        const endMatch = rest.match(/^##\s/m);
        const sectionContent = endMatch ? rest.substring(0, endMatch.index) : rest;

        return sectionContent;
    }

    /**
     * Igual que _parseTables(), pero conserva el header de cada tabla.
     * Es lo que hace falta en ALERTS_LOG.md, que mezcla dos formatos:
     * Una tabla de 6 columnas (# | Severidad | Tipo | DescripciÃ³n | Estado |
     * ResoluciÃ³n) y otra de 8 (... | Detectado | Ãšltima actualizaciÃ³n).
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
     * tabla que no tenga 'Severidad' y 'DescripciÃ³n': antes no hacÃ­a falta
     * distinguir, porque se leÃ­an posiciones fijas.
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

    /** Celda por Ã­ndice de columna mapeada. Columna ausente (-1) â†’ '' */
    static _cell(row, idx) {
        return (idx >= 0 && idx < row.length) ? (row[idx] || '') : '';
    }

    /** Parsea una tabla markdown â†’ array de arrays (sin header ni separador) */
    static _parseTable(text) {
        if (!text || typeof text !== 'string') return [];
        const lines = text.split('\n').filter(l => l.trim());
        // Encontrar la lÃ­nea del header de tabla
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

    /** Extrae estado de agente de descripciÃ³n */
    static _extractAgentStatus(desc) {
        if (!desc) return 'unknown';

        // Timeout explÃ­cito
        if (/TIMEOUT|timed?\s*out|â±/i.test(desc)) return 'timeout';

        // Error explÃ­cito
        if (/âŒ|\(error\)|\berror:/i.test(desc)) return 'error';

        // Ã‰xito explÃ­cito (âœ… o palabras de completado)
        if (/âœ…|ejecutado|completad|done|resuelt/i.test(desc)) return 'ok';

        // En progreso
        if (/ðŸ”„|en progreso|running/i.test(desc)) return 'running';

        // Idle
        if (/â³|â¸/.test(desc)) return 'idle';

        // Sin marcadores
        return 'unknown';
    }

    /** Parsea severidad de alerta */
    static _parseSeverity(text) {
        const normalized = text.toLowerCase();
        if (/ðŸ”´|alta|critical/i.test(normalized)) return 'critical';
        if (/ðŸŸ¡|media|medium/i.test(normalized)) return 'medium';
        if (/ðŸŸ¢|baja|low/i.test(normalized)) return 'low';
        return null;
    }

    /**
     * Parsea CRON_SCHEDULE.md â†’ crons, tareas en curso, bloqueadas, Ãºltimos resultados.
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
        const nextMatch = md.match(/>\s*PrÃ³xima actualizaciÃ³n esperada:\s*(.+)/i);
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

        // Parsear "Descripciones" â€” bloques: **Nombre**\nDescripciÃ³n
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

        // Parsear "Ãšltimos resultados de crons"
        const resultsSection = this._extractSection(md, 'Ãšltimos resultados de crons');
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
     * Parsea DASHBOARD_PO_IDEAS.md â†’ top prioridades + pospuestas.
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
            // Ignorar lÃ­neas de tabla markdown (empiezan con |)
            if (line.trim().startsWith('|')) return;

            // "ESCALADO a Pablo" (con o sin markdown bold)
            if (/ESCALADO a Pablo/i.test(line)) {
                let clean = line
                    .replace(/\*+/g, '')
                    .replace(/^\s*[-*ðŸš¨âš ï¸\d.]+\s*/, '')          // guiones, emojis, nÃºmeros al inicio
                    .replace(/^\d+\.\s*/, '')                     // numeraciÃ³n "1. "
                    .replace(/^ESCALADO a Pablo[.:]?\s*/i, '')    // prefijo redundante
                    .replace(/^ðŸš¨\s*/, '')                        // emoji extra
                    .trim();

                if (clean.length > 15) {
                    items.push({
                        severity: 'critical',
                        title: 'Escalado a Pablo',
                        detail: clean.substring(0, 250),
                        action: 'Requiere tu decisiÃ³n'
                    });
                }
            }
            // "Requires Pablo" (no duplicar si ya matcheÃ³ ESCALADO)
            else if (/Requires Pablo/i.test(line)) {
                let clean = line
                    .replace(/\*+/g, '')
                    .replace(/^\s*[-*ðŸš¨âš ï¸\d.]+\s*/, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();

                if (clean.length > 15) {
                    items.push({
                        severity: 'critical',
                        title: 'Requiere OK de Pablo',
                        detail: clean.substring(0, 250),
                        action: 'Requiere tu decisiÃ³n'
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
     * Parsea READY_FOR_PROMOTION.md â†’ items listos para promover.
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
     * Parsea IN_PROGRESS.md â†’ ramas activas.
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
                    // Â¿Esperando una decision de Pablo? La pregunta se extrae
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
        // seccion del archivo real es "### Cerradas en este ciclo" â€” tras los
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
     * tabla â€” y el item de cacheClear que espera a Pablo â€” no se veian.
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
            /queda la decisi[oÃ³]n de ([^.;|]+)/i,
            /decisi[oÃ³]n de (Pablo|ALERT-\d+|ALERTA-\d+)/i,
            /esperando (?:a |tu )?Pablo/i,
            /requiere (?:tu |la )?decisi[oÃ³]n (?:de Pablo )?/i,
            /falta (?:tu |la )?decisi[oÃ³]n/i
        ];
        for (const re of fuertes) {
            const m = t.match(re);
            // El motivo se muestra en el panel, la pegable en el boton: los
            // dos van como texto plano, asi que los dos se limpian. El
            // motivo sin limpiar dejaba "** El boton de cacheClear NO esta
            // aca: **P3**" â€” el ** de apertura caia antes de la palabra y
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
     * Â¿Esta rama realmente en curso?
     *
     * No pregunta "Â¿tiene texto?" sino "Â¿el texto dice que terminÃ³?".
     * Un item que dice MERGEADO y borrada no es un item en curso, por muy
     * completo que parezca su fila.
     *
     * âš ï¸ LA NEGACION ES EL TRAMPA. El archivo dice literalmente
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
        if (/\(a crear\)|todav[iÃ­]a\s+NO\s+iniciad/i.test(crudo)) {
            return { viva: false, motivo: 'no_iniciada' };
        }

        return { viva: true, motivo: null };
    }

    /**
     * Parsea la importancia de una comm (emoji â†’ key interno).
     */
    /**
     * Parsea "1h 15min" o "45min" o "2h" â†’ milisegundos.
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
        if (/ðŸ”´|crÃ­tica|critica|critical/.test(t)) return 'critical';
        if (/ðŸŸ¡|importante|important/.test(t)) return 'important';
        if (/ðŸŸ¢|rutinaria|routine/.test(t)) return 'routine';
        return 'unclassified';
    }

    /**
     * Parsea COMMS_DETAILS.md â†’ conversaciÃ³n completa de cada comm.
     * Estructura: ## comm-NNN + bloques (ðŸ“¤ PEDIDO / ðŸ“¥ RESPUESTA / ðŸ”„ REINTENTO / âœ… CONSUMO).
     */
    static parseCommsDetails(md) {
        const data = {
            parseable: true,
            conversations: {}
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // Dividir por "## comm-" (cada conversaciÃ³n)
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

            // Parsear metadata (lÃ­neas tipo "- Campo: valor")
            const metaLines = content.match(/^-\s*([^:]+):\s*(.+)$/gm) || [];
            metaLines.forEach(line => {
                const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
                if (m) conv.meta[m[1].trim()] = m[2].trim();
            });

            // Parsear bloques (### tÃ­tulo + cita)
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
     * Parsea PROMOTIONS.md â†’ feats pendientes de decisiÃ³n de Pablo +
     * decisiones ya tomadas (tab "Promociones").
     *
     * Robusto a cambios de formato: NO asume nombres de columna ni de
     * secciÃ³n, y NO busca el estado en toda la fila (eso produce falsos
     * positivos con frases como "No revertir ni modificar"). El estado se
     * lee del primer tÃ©rmino en negrita de la fila â€”que es la convenciÃ³n
     * del archivoâ€” y solo si falta se busca en el texto con lÃ­mites de
     * palabra.
     */
    /**
     * Parsea PROMOTIONS.md â†’ lo que espera tu decisiÃ³n, lo que estÃ¡
     * explÃ­citamente fuera, lo congelado, y el historial.
     *
     * POR QUÃ‰ ESTE PARSER FUE REESCRITO (2026-09-30)
     *
     * Antes las filas se aplastaban en un solo string con " â€” " y el estado
     * se sacaba del PRIMER texto en negrita. Con la tabla real de
     * PROMOTIONS.md eso daba tres mentiras:
     *
     *   1. La tabla se titula "Por quÃ© NO es candidato". El primer **...** de
     *      cada fila es "**0 callers.**" o "**Es cÃ³digo de test.**", que no es
     *      un estado. Resultado: state "unknown".
     *   2. Con state "unknown" los items caÃ­an en la secciÃ³n de "Decisiones
     *      tomadas" por descarte, NO porque estuvieran decididos. Se mostraban
     *      como decisiones tomadas cosas que nadie decidiÃ³.
     *   3. El peor: 392c3b9 dice "**PENDIENTE**. No revertir ni modificar hasta
     *      instrucciÃ³n de Pablo". El primer **...** es PENDIENTE, asÃ­ que
     *      entraba en "Esperando tu decisiÃ³n" con un badge de pendiente, que
     *      se lee como "dale que sÃ­". La tab convertÃ­a un "no toques esto" en
     *      un "decidÃ­ esto".
     *
     * Arreglo de fondo: las columnas se identifican por NOMBRE de encabezado,
     * nunca por posiciÃ³n. Si el equipo agrega, saca o reordena columnas, el
     * parser sigue leyÃ©ndolas bien. Y hay un estado nuevo, "congelado", que
     * es el mÃ¡s importante de la tab y no existÃ­a.
     */
    static parsePromotions(md) {
        const data = {
            parseable: true,
            updatedAt: null,
            esperando: [],      // espera una decisiÃ³n de Pablo
            congelado: [],      // "no revertir ni modificar" â†’ NO es decisiÃ³n
            prodSinVerificar: [],  // YA en producciÃ³n, sin confirmar que funcione
            noCandidato: [],    // explÃ­citamente no es candidato a promociÃ³n
            indeterminado: [],  // no se pudo leer el estado; se dice, no se supone
            decidido: []        // historial de decisiones tomadas
        };

        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // La fecha sale de las FILAS, no de todo el documento.
        //
        // Antes tomaba la primera fecha del texto entero, y en un archivo que
        // explica en su prosa que el estado "EN PRODUCCIÃ“N, SIN VERIFICAR"
        // existe "desde el 2026-10-01", esa prosa le ganaba a los datos: la tab
        // decÃ­a "actualizado 2026-10-01" el mismo dÃ­a que se registraba la
        // promociÃ³n del 2026-10-04. "Ãšltima actualizaciÃ³n" tiene que ser el
        // dato mÃ¡s reciente que escribiÃ³ el equipo, no una fecha citada de
        // pasada en un pÃ¡rrafo explicativo.
        const filas = md.split('\n').filter(l => l.trim().startsWith('|'));
        const dFecha = filas.join('\n').match(/\d{4}-\d{2}-\d{2}/);
        if (dFecha) data.updatedAt = dFecha[0];

        const sections = md.split(/^##\s+/m).slice(1);
        let foundSections = false;

        sections.forEach(section => {
            const nl = section.indexOf('\n');
            const title = (nl === -1 ? section : section.substring(0, nl)).trim();
            const body = nl === -1 ? '' : section.substring(nl + 1);

            // "decididas" tiene que ir antes que "decisiÃ³n": /decisi/ matchea
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
     * PRIMERO porque su texto suele decir tambiÃ©n "pendiente" y ganarÃ­a el
     * primer partido si se probara despuÃ©s.
     */
    static _clasificarPromo(data, item, isDecision) {
        // Antes de la rama de decisiones, y antes que congelado.
        //
        // El item estÃ¡ en la tabla de "Decisiones tomadas" (isDecision), asÃ­
        // que sin esto caerÃ­a en `congelado` por su "No revertir ni modificar
        // hasta que se verifique" â€” y quedarÃ­a pidiendo una decisiÃ³n sobre algo
        // que ya estÃ¡ resuelto, que es el bug que esta tab ya tuvo una vez.
        // Lo que le falta no es la decisiÃ³n: es la PRUEBA.
        if (item.prodSinVerificar) {
            data.prodSinVerificar.push(item);
            return;
        }
        if (isDecision) {
            // En el historial "PENDIENTE" no significa "esperando tu
            // decisiÃ³n": significa "asÃ­ quedÃ³, sin resolver". 392c3b9 dice
            // "PENDIENTE. No revertir ni modificar hasta instrucciÃ³n de Pablo":
            // eso NO es una tarea para vos, es un aviso de que hay que
            // dejarlo quieto. Va a su propio bucket con su propio cartel.
            //
            // En cambio 57008ae dice "AUTORIZADO en producciÃ³n. No tocar.":
            // tambiÃ©n dice "no tocar", pero la decisiÃ³n YA estÃ¡ tomada, asÃ­
            // que va al historial con la nota de "no tocar" al lado. Meterlo
            // en "congelado" lo harÃ­a parecer que falta algo por decidir.
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
        // resuelto. Antes caÃ­a en "decisiones tomadas" por descarte.
        data.indeterminado.push(item);
    }

    /**
     * Tabla con encabezado. A diferencia de _parseTable(), NO tira la fila
     * de encabezados: sin ella las columnas son anÃ³nimas y no hay forma de
     * saber cuÃ¡l es cuÃ¡l salvo por posiciÃ³n, que es exactamente el
     * supuesto que rompiÃ³ todo lo anterior.
     */
    // Todas las tablas de un texto, con su encabezado.
    //
    // Antes esta funciÃ³n devolvÃ­a SÃ“LO la primera y cortaba al terminar.
    // Eso estÃ¡ bien para las tablas de una sola, pero la secciÃ³n "Pendientes
    // de decisiÃ³n" de PROMOTIONS.md tiene dos tablas separadas por prosa: la
    // primera con el Ãºnico feat que sÃ­ espera tu decisiÃ³n, y la segunda â€”
    // "Por quÃ© NO es candidato" â€” con el resto. Con una sola tabla, el
    // segundo grupo no se leÃ­a NADA y sus filas desaparecÃ­an sin dejar rastro,
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
     * Convierte una fila con encabezado conocido â†’ item. Busca cada campo por
     * el NOMBRE de su columna, con un orden de preferencia, asÃ­ que agregar o
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
        // La columna que antes se perdÃ­a. Es la razÃ³n por la que un item NO es
        // candidato, que es justo lo que hace falta para no molestarlo.
        const cMotivo = celda(/por qu|criterio|motivo|raz[oÃ³]n|porque|nota/i);
        // La columna nueva, opcional: dÃ³nde probar el cambio en dev.
        const cRuta   = celda(/d[oÃ³]nde verlo|ruta|ver en dev|pantalla|screen|deep.?link/i);

        // Que la columna se llame "Por quÃ© NO es candidato" ES la seÃ±al de no
        // candidato, y estaba en el encabezado, que se descartaba. Sin esto el
        // motivo ("Es cÃ³digo de test") llegaba como texto suelto y el item
        // caÃ­a en "no se pudo leer". Con esto se lee lo que el equipo escribiÃ³
        // como tÃ­tulo de la columna.
        let motivoHdr = null;
        if (header && header.length) {
            for (let i = 0; i < header.length; i++) {
                if (/por qu|criterio|motivo|raz[oÃ³]n|porque|nota/i.test(header[i] || '')) {
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

        const todo = [cFeat, cRama, cComm, cDec, cMotivo, cRuta].filter(Boolean).join(' â€” ');
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
     * normalizar en el render, y ahÃ­ es donde se cuelan los links rotos.
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
        const raw = (Array.isArray(cells) ? cells.join(' â€” ') : String(cells)).trim();
        if (!raw) return null;
        return this._armarPromo({ texto: raw, raw: raw }, isDecision);
    }

    /**
     * Armado comÃºn: acÃ¡ se decide el estado, el nombre del feature y la
     * separaciÃ³n nombre/detalle.
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

        // "congelado" se evalÃºa sobre TODO el texto de la fila, no sobre el
        // primer **...**. La razÃ³n: en 392c3b9 el primer tÃ©rmino en negrita
        // es PENDIENTE, pero la frase que define el estado real es "No
        // revertir ni modificar hasta instrucciÃ³n de Pablo", y estÃ¡ mÃ¡s
        // abajo. Mirar solo el primer bold es lo que produjo el bug.
        const congelado = !!(
            /no revertir|sin revertir|no modificar|sin modificar|no tocar|intocable|congelad|hasta instrucci|hasta que Pablo|no revertir ni/i.test(raw)
        );

        // "EstÃ¡ en producciÃ³n pero nadie confirmÃ³ que funcione" (2026-10-01).
        //
        // Se evalÃºa ANTES que congelado y antes que el state, por una razÃ³n
        // concreta: la fila dice "No revertir ni modificar hasta que se
        // verifique", asÃ­ que el regex de congelado la matchea y se la lleva.
        // Con el orden viejo, un item que YA estÃ¡ en producciÃ³n se renderiza
        // como "congelado" â€” que es exactamente lo que dice la fila, pero
        // esconde lo Ãºnico que le importa a Pablo: que falta probarlo.
        //
        // El patrÃ³n busca SOLO expresiones de duda: "sin verificar", "nadie lo
        // verificÃ³", "todavÃ­a no se verificÃ³". Deliberadamente NO matchea
        // "verificado": un "AUTORIZADO, verificado por Pablo" es lo contrario
        // de lo que representa este estado, y un regex que lo absorbiera
        // mandarÃ­a lo ya revisado al bloque de "falta probar".
        const prodSinVerificar = !!(
            /(?:sin|no)\s+verific|nadie\s+(?:lo|la|los|las)?\s*verific|no\s+se\s+pudo\s+verific|todav[iÃ­]a\s+no\s+(?:se|lo|la)?\s*verific|queda\s+(?:por|pendiente)?\s*verificar|falta\s+verificar|(?:sin|nadie\s+)\s*confirm\w*/i.test(raw)
        );

        const noCandidato = !!entrada.noCandidatoPorColumna || !!(
            /no es candid|no son candidat|no candidata|excluido|excluida|descartad|0 callers|no aplica a promoci/i.test(raw)
        );

        // Estado: sale de la columna "Estado" si la tabla la tiene, y recien
        // si no del primer **...** de la fila.
        //
        // Por quÃ© el orden importa y por quÃ© esto estaba roto: el primer
        // negrita de la fila del botÃ³n de cachÃ© es el NOMBRE del feature
        // ("**Idea 50 completa â€” el botÃ³n de liberar cachÃ©**"), porque la
        // columna Feat viene antes que la columna Estado y la celda viene en
        // negrita. El estado real ("**LISTO.**") era el segundo. Con el
        // "primer negrita" el Ãºnico item accionable de la tab caÃ­a en
        // "no se pudo leer" y nadie podÃ­a verlo.
        const primerBold = s => {
            const m = String(s || '').match(/\*\*([^*]+)\*\*/);
            return m ? m[1] : null;
        };
        const probe = primerBold(entrada.detalle) || primerBold(raw) || raw;
        let state = 'unknown';
        // prodSinVerificar va PRIMERO: si no, la frase "hasta que se verifique"
        // de la fila la manda a 'congelado', que es verdad pero no es lo que
        // hay que mostrar. Lo que hay que mostrar es que ya estÃ¡ en
        // producciÃ³n y le falta la prueba.
        if (prodSinVerificar) state = 'prod_sin_verificar';
        else if (congelado) state = 'congelado';
        else if (noCandidato) state = 'no_candidato';
        // "LISTO." a secas es el estado real del botÃ³n de cacheClear. Las dos
        // reglas anteriores pedÃ­an "listo para probar" y caÃ­an en unknown, que
        // mandaba el Ãºnico item accionable de la tab al bucket "no se pudo
        // leer". Se prueba el probe como palabra suelta, no la fila entera:
        // "listo" en la letra chica de otro texto no debe convertirlo en
        // candidato.
        else if (/^\W*listo\W*$/i.test(probe)) state = 'ready';
        else if (/pendient|esperando|por decidir/i.test(probe)) state = 'pending';
        else if (/listo para probar|probar|para tu prueba/i.test(probe)) state = 'ready';
        else if (/revertid|rechazad|descartad|sacad/i.test(probe)) state = 'reverted';
        else if (/autorizad|aprobad|promovid/i.test(probe)) state = 'authorized';
        else if (/probado|testeado/i.test(probe)) state = 'tested';

        // "Â¿EstÃ¡ esto ya decidido?" va aparte del estado, porque "congelado" y
        // "decidido" no se excluyen: 57008ae estÃ¡ autorizado Y dice "no
        // tocar", y 392c3b9 estÃ¡ pendiente Y dice "no revertir". Los dos
        // mentions "no tocar"; solo uno falta que se decida. Sin este campo,
        // el bucket "congelado" se llevaba tambiÃ©n el que ya estaba resuelto.
        const decidido = /autorizad|aprobad|promovid|revertid|rechazad|descartad|sacad/i.test(probe);

        // Nombre del feature y detalle: NO se parte por el primer ":".
        //
        // El nombre real del botÃ³n es "Idea 50 completa â€” el botÃ³n de liberar
        // cachÃ©" y despuÃ©s viene un parÃ©ntesis largo que empieza con un ":"
        // ("(Tramos A-F: cacheClear con dryRun, ...)"). Partir por el primer
        // dos puntos cortaba el nombre a mitad de palabra y dejaba
        // "Idea 50 completa â€” el botÃ³n de liberar cachÃ© (Tramos A-F" como
        // tÃ­tulo. Los dos puntos solo separan un detalle cuando estÃ¡n
        // FUERA del parÃ©ntesis.
        const { nombre, detalle: det, cola } = this._nombreYDetalle(texto);
        const detalle = entrada.detalle || det || null;

        if (!nombre && !commit) return null;

        return {
            fecha,
            commit,
            commits: shas,
            nombre: nombre || '(sin descripciÃ³n)',
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
     *   "Idea 50 completa â€” el botÃ³n (Tramos A-F: cacheClear â€¦)"
     *       â†’ nombre "Idea 50 completa â€” el botÃ³n"
     *         cola   "Tramos A-F: cacheClear â€¦"
     *
     *   "(Solitary Throne CM daily tracker): PENDIENTE. No revertirâ€¦"
     *       â†’ nombre "Solitary Throne CM daily tracker"
     *         detalle "PENDIENTE. No revertirâ€¦"
     *
     * Los shas SOLO se quitan del principio. Si se limpian de todo el texto,
     * "revertido con `a1a53c4`" queda como "revertido con ." y el dashboard
     * muestra una frase rota. El sha va en su propio campo de todas formas.
     */
    static _nombreYDetalle(textoCrudo) {
        let txt = String(textoCrudo)
            .replace(/^(?:[`\s,]*[0-9a-f]{7,40}[`\s,â€“-]*)+/i, '')  // shas al inicio
            .replace(/^[-â€”â€“:.\s]+/, '')
            .trim();
        if (!txt) return { nombre: '', detalle: null, cola: null };

        // "(nombre): detalle"
        const abre = txt.match(/^\(([^)]*)\)\s*[:â€”â€“]\s*(.+)$/);
        if (abre && abre[1].trim().length >= 3) {
            return { nombre: abre[1].trim(), detalle: abre[2].trim(), cola: null };
        }

        // "nombre (cola larga)"  â†’ la cola no es el detalle de una decisiÃ³n,
        // es la letra chica del feature.
        const colaLarga = txt.match(/^([^(]{3,90}?)\s*\(([^)]{25,})\)\s*$/);
        if (colaLarga) {
            return { nombre: colaLarga[1].trim(), detalle: null,
                     cola: colaLarga[2].trim() };
        }

        // "(nombre)" solo
        const solo = txt.match(/^\(([^)]{3,90})\)\s*$/);
        if (solo) return { nombre: solo[1].trim(), detalle: null, cola: null };

        // "nombre: detalle" (dos puntos fuera de parÃ©ntesis)
        const punto = txt.match(/^([^:]{3,90}):\s*(.+)$/);
        if (punto) return { nombre: punto[1].trim(), detalle: punto[2].trim(), cola: null };

        return { nombre: txt, detalle: null, cola: null };
    }

    /**
     * Parsea PRE_BACKLOG.md â†’ ideas en espera del PO.
     *
     * 2026-10-05. La tab [P] Pre-backlog existia en index.html con su
     * container #prebacklog-container pero ningÃºn script la llenaba:
     * era una caja vacia con dos botones que no hacia nada. El parser
     * faltaba, y con el la informacion del PO nunca llegaba al panel.
     *
     * Formato esperado (el PO escribe estos .md con su heartbeat):
     *   ## Ideas
     *   | ID | Idea | Fuente | Estado | Observaciones |
     *   |----|------|--------|--------|---------------|
     *   | PB-01 | ... | Reddit | pendiente | ... |
     */
    /**
     * Parsea PRE_BACKLOG.md â€” pre-backlog del Product Owner.
     *
     * 2026-10-05. Formato NARRATIVO (no tabla). El archivo tiene:
     * 1. SecciÃ³n "Ideas en bruto" con ideas sin filtrar
     * 2. Secciones "Heartbeat PO <fecha>" con anÃ¡lisis detallados
     * 3. Cada Heartbeat puede contener mÃºltiples IDEAs numeradas
     *
     * Extraemos:
     * - updatedAt del marcador "> Actualizado: <fecha>"
     * - Ideas de la secciÃ³n "Ideas en bruto" (formato libre)
     * - IDEAs de cada Heartbeat (patrÃ³n "IDEA NN" o "IDEA NNX")
     */
    /**
     * Parsea PRE_BACKLOG.md â€” pre-backlog del Product Owner.
     *
     * 2026-10-05. Formato NARRATIVO (no tabla). El archivo tiene:
     * 1. SecciÃ³n "Ideas en bruto" con ideas sin filtrar
     * 2. Secciones "Heartbeat PO <fecha>" separadas por lÃ­neas `---` (horizontal rule)
     * 3. Cada Heartbeat puede contener mÃºltiples IDEAs numeradas
     *
     * Extraemos:
     * - updatedAt del marcador "> Actualizado: <fecha>" (si existe)
     * - Ideas de la secciÃ³n "Ideas en bruto" (formato libre)
     * - IDEAs de cada Heartbeat (patrÃ³n "IDEA NN" o "IDEA NNX")
     */
    static parsePreBacklog(md) {
        const data = { parseable: true, updatedAt: null, ideas: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }

        // updatedAt - buscar varios formatos posibles
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i) ||
                             md.match(/Actualizado:\s*(.+)/i) ||
                             md.match(/^#.*?(\d{4}-\d{2}-\d{2})/m);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        // 1) SecciÃ³n "Ideas en bruto" - formato libre
        const ideasSection = this._extractSection(md, 'Ideas en bruto');
        if (ideasSection) {
            const lines = ideasSection.split('\n');
            let currentIdea = null;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const isNewIdea = /^[-*]/.test(trimmed) ||
                                  /^IDEA\s+\d+/.test(trimmed) ||
                                  (trimmed.length > 20 && !/^---/.test(trimmed));

                if (isNewIdea && currentIdea) {
                    data.ideas.push(currentIdea);
                }

                if (isNewIdea) {
                    currentIdea = {
                        id: 'raw-' + data.ideas.length,
                        titulo: trimmed.substring(0, 120),
                        fuente: 'PO (bruto)',
                        estado: 'bruto',
                        observaciones: trimmed.substring(120)
                    };
                } else if (currentIdea) {
                    currentIdea.observaciones += ' ' + trimmed;
                }
            }
            if (currentIdea) data.ideas.push(currentIdea);
        }

        // 2) Heartbeats del PO - dividir por lÃ­neas `---` (horizontal rules)
        // El archivo usa `---` como separador entre Heartbeats
        const sections = md.split(/^---$/m);
        for (const section of sections) {
            // Verificar si esta secciÃ³n es un Heartbeat PO
            if (!/Heartbeat PO/i.test(section)) continue;

            // Extraer fecha del heartbeat
            const dateMatch = section.match(/Heartbeat PO\s+([\d\-]+\s+[\d:]+)/i);
            const hbDate = dateMatch ? dateMatch[1].trim() : 'fecha desconocida';

            // Buscar IDEAs en este heartbeat - varios formatos
            // Formato 1: "### IDEA NN: tÃ­tulo" o "## IDEA NN - tÃ­tulo"
            let ideaMatches = section.match(/^###?\s*IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/gim);
            if (ideaMatches) {
                for (const im of ideaMatches) {
                    const imMatch = im.match(/IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/i);
                    if (imMatch) {
                        const ideaNum = imMatch[1];
                        const ideaTitle = imMatch[2].trim().substring(0, 120);

                        // Extraer contexto: primeras lÃ­neas despuÃ©s del tÃ­tulo
                        const afterTitle = section.substring(section.indexOf(im) + im.length);
                        const contextLines = afterTitle.split('\n').slice(0, 10)
                            .map(l => l.trim())
                            .filter(l => l && !/^###?\s*(IDEA|Heartbeat|P\d)/i.test(l))
                            .join(' ').substring(0, 300);

                        data.ideas.push({
                            id: 'PO-' + ideaNum,
                            titulo: ideaTitle,
                            fuente: 'PO Heartbeat ' + hbDate,
                            estado: 'propuesta',
                            observaciones: contextLines || 'Ver Heartbeat completo en PRE_BACKLOG.md'
                        });
                    }
                }
            }

            // Formato 2: "## 1. IDEA XX ..." o "1. IDEA XX ..."
            const altIdeas = section.match(/^\d+\.\s*(IDEA\s+\d+[A-Z]?\b.*?)(?=\n\d+\.|\n###?\s|\Z)/gim);
            if (altIdeas) {
                for (const ai of altIdeas) {
                    const aiMatch = ai.match(/IDEA\s+(\d+[A-Z]?)\b(.*)/i);
                    if (aiMatch) {
                        const ideaNum = aiMatch[1];
                        const ideaTitle = aiMatch[2].trim().substring(0, 120);
                        if (!data.ideas.some(i => i.id === 'PO-' + ideaNum)) {
                            data.ideas.push({
                                id: 'PO-' + ideaNum,
                                titulo: ideaTitle,
                                fuente: 'PO Heartbeat ' + hbDate,
                                estado: 'propuesta',
                                observaciones: 'Ver Heartbeat completo en PRE_BACKLOG.md'
                            });
                        }
                    }
                }
            }

            // Formato 3: IDEA en el tÃ­tulo del Heartbeat mismo
            // "## Heartbeat PO ... - IDEA 49G: tÃ­tulo"
            const titleIdeaMatch = section.match(/Heartbeat PO.*?- IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/i);
            if (titleIdeaMatch && !data.ideas.some(i => i.id === 'PO-' + titleIdeaMatch[1])) {
                data.ideas.push({
                    id: 'PO-' + titleIdeaMatch[1],
                    titulo: titleIdeaMatch[2].trim().substring(0, 120),
                    fuente: 'PO Heartbeat ' + hbDate,
                    estado: 'propuesta',
                    observaciones: 'Ver Heartbeat completo en PRE_BACKLOG.md'
                });
            }

            // Formato 4: Buscar "IDEA NN" en cualquier parte de la secciÃ³n (fallback)
            if (data.ideas.filter(i => i.fuente.includes(hbDate)).length === 0) {
                const fallbackMatches = section.match(/IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/gi);
                if (fallbackMatches) {
                    for (const fm of fallbackMatches) {
                        const fmMatch = fm.match(/IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/i);
                        if (fmMatch && !data.ideas.some(i => i.id === 'PO-' + fmMatch[1])) {
                            data.ideas.push({
                                id: 'PO-' + fmMatch[1],
                                titulo: fmMatch[2].trim().substring(0, 120),
                                fuente: 'PO Heartbeat ' + hbDate,
                                estado: 'propuesta',
                                observaciones: 'Ver Heartbeat completo en PRE_BACKLOG.md'
                            });
                        }
                    }
                }
            }
        }

        // 3) Fallback global: buscar cualquier "IDEA XX" en el archivo completo
        if (data.ideas.length === 0) {
            const allIdeas = md.match(/IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/gi);
            if (allIdeas) {
                for (const ai of allIdeas) {
                    const aiMatch = ai.match(/IDEA\s+(\d+[A-Z]?)\s*[:\-]\s*(.+)/i);
                    if (aiMatch) {
                        data.ideas.push({
                            id: 'PO-' + aiMatch[1],
                            titulo: aiMatch[2].trim().substring(0, 120),
                            fuente: 'PRE_BACKLOG.md',
                            estado: 'propuesta',
                            observaciones: 'ExtracciÃ³n fallback'
                        });
                    }
                }
            }
        }

        return data;
    }

    /**
    /**
     * Parsea BACKLOG.md — tareas priorizadas.
     *
     * Formato esperado (BACKLOG.md):
     *   > Actualizado: ...
     *   ## EN CURSO ...
     *   - [x] **Título** — Descripción
     *   - [ ] **Título** — Descripción
     *   ## Pendientes (prioridad alta)
     *   - [ ] **Título** — Descripción
     */
    static parseBacklog(md) {
        const data = { parseable: true, updatedAt: null, tareas: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        // Buscar todas las secciones que contienen checkboxes
        // Patrón: ## Título de sección
        const sectionRegex = /^##\s+(.+)$/gm;
        let match;
        const sections = [];

        while ((match = sectionRegex.exec(md)) !== null) {
            const title = match[1].trim();
            const start = match.index + match[0].length;
            sections.push({ title, start, end: md.length });
        }
        // Calcular end de cada sección
        for (let i = 0; i < sections.length - 1; i++) {
            sections[i].end = sections[i + 1].start;
        }

        // Determinar prioridad basada en el título de la sección
        function getPriority(sectionTitle) {
            const t = sectionTitle.toLowerCase();
            if (t.includes('urgente')) return 'urgente';
            if (t.includes('en curso') || t.includes('en progreso')) return 'en curso';
            if (t.includes('alta')) return 'alta';
            if (t.includes('media')) return 'media';
            if (t.includes('baja')) return 'baja';
            return 'normal';
        }

        // Procesar cada sección
        for (const sec of sections) {
            const sectionContent = md.substring(sec.start, sec.end);
            const priority = getPriority(sec.title);

            // Buscar checkboxes: - [x] o - [ ]
            const checkboxRegex = /^-\s*\[([ x])\]\s*(.+)$/gm;
            let cbMatch;
            while ((cbMatch = checkboxRegex.exec(sectionContent)) !== null) {
                const checked = cbMatch[1] === 'x';
                const fullText = cbMatch[2].trim();

                // Extraer título (entre ** **) y observaciones
                let titulo = fullText;
                let observaciones = '';
                const boldMatch = fullText.match(/^\*\*(.+?)\*\*(?:\s*[—-]\s*(.+))?$/);
                if (boldMatch) {
                    titulo = boldMatch[1].trim();
                    observaciones = boldMatch[2] ? boldMatch[2].trim() : '';
                } else {
                    // Fallback: primera frase como título
                    const parts = fullText.split(/[.!?]\s+/);
                    titulo = parts[0].trim();
                    observaciones = parts.slice(1).join(' ').trim();
                }

                // Generar ID simple
                const id = titulo.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

                data.tareas.push({
                    id: id || 'tarea-' + data.tareas.length,
                    titulo: this._cleanCell(titulo),
                    prioridad: priority,
                    estado: checked ? 'completado' : 'pendiente',
                    observaciones: this._cleanCell(observaciones)
                });
            }
        }

        return data;
    }

    /**
     * Parsea FEATURES.md â†’ features construidas por el equipo.
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
    /**
     * Parsea FEATURES.md — fichas de features construidas.
     *
     * Formato esperado (FEATURES.md):
     *   ## Nombre de fantasía
     *   - **Tipo:** nueva | mejora visible | mejora oculta
     *   - **Estado:** listo | probado ok | probado no va | autorizado | rechazado | revertido
     *   - **Dónde la veo:** ...
     *   - **Ruta:** ...
     *   - **Descripción:** ...
     *   - **Commits:** `<sha>`, `<sha>` / merge `<sha>`
     *   - **Rama:** `<nombre de rama>`
     *   - **Si no entra:** ...
     *   - **Si sale mal:** ...
     */
    /**
     * Parsea FEATURES.md — fichas de features construidas.
     *
     * Formato esperado (FEATURES.md):
     *   ## Nombre de fantasía
     *   - **Tipo:** nueva | mejora visible | mejora oculta
     *   - **Estado:** listo | probado ok | probado no va | autorizado | rechazado | revertido
     *   - **Dónde la veo:** ...
     *   - **Ruta:** ...
     *   - **Descripción:** ...
     *   - **Commits:** `<sha>`, `<sha>` / merge `<sha>`
     *   - **Rama:** `<nombre de rama>`
     *   - **Si no entra:** ...
     *   - **Si sale mal:** ...
     */
    static parseFeatures(md) {
        const data = { parseable: true, updatedAt: null, features: [] };
        if (!md || typeof md !== 'string') {
            return { parseable: false, ...data };
        }
        const updatedMatch = md.match(/>\s*Actualizado:\s*(.+)/i);
        if (updatedMatch) data.updatedAt = updatedMatch[1].trim();

        // Normalizar finales de línea ANTES de procesar
        md = md.replace(/\r/g, '');

        // Buscar secciones que empiezan con ## (fichas de features)
        // Excluir secciones de documentación/meta
        const sectionRegex = /^##\s+(.+)$/gm;
        let match;
        const sections = [];

        while ((match = sectionRegex.exec(md)) !== null) {
            const title = match[1].trim();
            // Saltar secciones de documentación/meta
            if (title.match(/^(C[óo]mo|Fichas|Qu[ée] significa|Regla|Importar|Nombre de fantas[ií]a|C[oó]mo leer)/i)) continue;
            const start = match.index + match[0].length;
            sections.push({ title, start, end: md.length });
        }
        // Calcular end de cada sección
        for (let i = 0; i < sections.length - 1; i++) {
            sections[i].end = sections[i + 1].start;
        }

        // Mapear estado a clases CSS
        const estadoMap = {
            'listo': 'listo',
            'probado ok': 'probado-ok',
            'probado no va': 'probado-no-va',
            'autorizado': 'autorizado',
            'rechazado': 'rechazado',
            'revertido': 'revertido',
            'pendiente': 'pendiente'
        };

        for (const sec of sections) {
            const content = md.substring(sec.start, sec.end);
            
            // Extraer campos clave-valor: - **Campo:** valor (el ** cierra después de los dos puntos)
            // Solo tomar la PRIMERA ocurrencia de cada campo (los datos del feature vienen antes que la plantilla/doc)
            const fields = {};
            const fieldRegex = /^-\s*\*\*([^:]+):\*\*\s*(.+)/gm;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(content)) !== null) {
                const key = fieldMatch[1].trim().toLowerCase();
                const value = fieldMatch[2].trim();
                if (!(key in fields)) {
                    fields[key] = value;
                }
            }

            // Solo procesar si tiene campos esperados de una ficha
            if (!fields.tipo && !fields.estado && !fields['dónde la veo'] && !fields.ruta) {
                continue;
            }

            const estadoRaw = fields.estado || 'pendiente';
            const estado = estadoMap[estadoRaw.toLowerCase()] || estadoRaw.toLowerCase().replace(/[^a-z0-9]/g, '-');

            // Extraer commits y rama
            let sha = null;
            if (fields.commits) {
                const shaMatch = fields.commits.match(/`([a-f0-9]{7,40})`/i);
                if (shaMatch) sha = shaMatch[1].substring(0, 7);
            }

            // Archivos (no hay en el formato actual, dejar vacío)
            const archivos = [];

            // Normalizar ID: quitar acentos, reemplazar no alfanuméricos por -
            const normalizeId = (str) => str
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
                .replace(/[^a-zA-Z0-9]+/g, '-') // reemplazar secuencias no alfanum por -
                .replace(/^-+|-+$/g, '') // quitar guiones al inicio/fin
                .toLowerCase()
                .substring(0, 50);

            data.features.push({
                id: normalizeId(sec.title),
                nombre: sec.title,
                estado: estado,
                archivos: archivos,
                description: fields.descripción || fields.descripcion || fields['dónde la veo'] || null,
                sha: sha,
                tipo: fields.tipo || '',
                rama: fields.rama || '',
                ruta: fields.ruta || ''
            });
        }

        return data;
    }
}



