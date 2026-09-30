/**
 * js/live-status.js
 * Panel "Estado en vivo" — Vista rápida del estado de cada agente.
 * Fuentes: commits + SESSION_LOG + el canal REAL de cada agente, que viene
 * de data/estructura.json (crons y heartbeats verificados por el Arquitecto).
 *
 * El estado de actividad sigue siendo estimado a partir de commits y menciones:
 * el dashboard no habla con QwenPaw. Lo que NO es estimado es el canal: antes
 * Reviewer y Documentador venian marcados como "caidos por timeout" de forma
 * fija, sin mirar nada. Eso era falso. Ahora cada tarjeta dice si el agente
 * tiene un heartbeat o no.
 */

class DashboardLiveStatus {

    // `queDecide` viene del AGENTS.md de cada agente, no de una opinion mia.
    // Es la columna "quién hace qué": para qué existe cada uno, no qué hizo
    // últimamente. Lo último cambia cada media hora; esto no.
    //
    // NO VA "Principal (Admin)". Nunca fue un agente: era un chat manual de
    // Pablo dentro de `default`, y hacia la tarea que despues asumio el
    // Arquitecto (estructura, permisos, crons). Contarlo como miembro del
    // equipo hacia que el dashboard anunciara una segunda unidad con el mismo
    // agent_id, el mismo cron y la misma sesion que la de arriba. Una fila
    // menos, y el reparto real.
    static AGENTS = [
        { id: 'principal-desarrollo', nombre: 'Principal', refAgente: 'default', icon: '🚀',
          queDecide: 'Implementa features y fixes en gw2-dev, y reparte el trabajo al resto del equipo. Es el único que escribe código del producto.',
          scopes: ['legendary', 'feature', 'feat', 'commit'] },
        { id: 'po',          nombre: 'Product Owner', refAgente: 'product-owner', icon: '📝',
          queDecide: 'Investiga afuera (Reddit, Wiki, gw2treasures) y decide qué merece la pena. Propone, no implementa.',
          scopes: ['po', 'backlog'] },
        { id: 'reviewer',    nombre: 'Code Reviewer', refAgente: 'Code-Reviewer',  icon: '🔍',
          queDecide: 'Audita lo que el Principal propone y lo veta si no se sostiene. No aprueba por aprobar.',
          scopes: ['reviewer', 'review'] },
        { id: 'documenter',  nombre: 'Documentador',  refAgente: 'documenter',  icon: '📚',
          queDecide: 'Escribe los logs, commitea y pushea a agents. Nunca toca gw2-prod.',
          scopes: ['docs', 'doc'] },
        { id: 'architect',   nombre: 'Arquitecto',   refAgente: 'architect',   icon: '🏗️',
          queDecide: 'Topología de clones, permisos y crons. Habla solo con vos. Este dashboard es suyo.',
          scopes: ['estructura', 'org', 'dashboard', 'mcp', 'permiso'] }
    ];

    static render(data) {
        const container = document.getElementById('live-status-container');
        if (!container) return;

        const statuses = this.AGENTS.map(agent => this._computeStatus(agent, data));

        // 3 secciones en el orden en que se leen: QUIÉN ES (fijo, para saber a
        // qué le toca y qué esperar), AHORA (cambia cada media hora) y
        // CUÁNDE VUELVE (lo único accionable de la tab).
        container.innerHTML = [
            this._seccionQuienHaceQue(statuses),
            this._seccionAhora(statuses),
            this._seccionAQuienEsperar(statuses)
        ].join('');
    }

    /** "Quién hace qué": identidad y propósito. No cambia de un día a otro. */
    static _seccionQuienHaceQue(statuses) {
        const filas = statuses.map(s => `
            <tr>
                <td class="eq-who__agente">${s.icon} ${this._escape(s.nombre)}</td>
                <td class="eq-who__que">${this._escape(s.queDecide)}</td>
                <td class="eq-who__cada">${this._cadaCuando(s)}</td>
            </tr>`).join('');

        return `
        <section class="eq-block">
            <h3 class="eq-block__title">🧭 Quién hace qué</h3>
            <p class="eq-block__hint">Para qué existe cada uno. No es el estado: es el reparto.</p>
            <div class="eq-table-wrap">
                <table class="eq-table">
                    <thead><tr><th>Agente</th><th>Qué decide</th><th>Cada cuánto</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </section>`;
    }

    /** "Ahora": el estado, con su causa cuando hay una. */
    static _seccionAhora(statuses) {
        const conReloj = statuses.filter(s => s.canal.activo).length;
        const porDemanda = statuses.length - conReloj;

        return `
        <section class="eq-block">
            <h3 class="eq-block__title">⚡ Ahora</h3>
            <p class="eq-block__hint">
                <strong>${conReloj}</strong> con reloj propio ·
                <strong>${porDemanda}</strong> solo cuando vos los llamás.
                Un agente sin reloj nunca puede estar CAÍDO: no tiene nada que vencerse.
            </p>
            <div class="live-grid">${statuses.map(s => this._cardHTML(s)).join('')}</div>
        </section>`;
    }

    /**
     * "A quién esperar": la sección que faltaba y la única accionable.
     * Cada agente con reloj tiene una próxima corrida predictable; sayla es
     * la diferencia entre "el equipo está roto" y "todavía no le tocaba".
     */
    static _seccionAQuienEsperar(statuses) {
        const conReloj = statuses.filter(s => s.canal.activo)
                                 .sort((a, b) => (a.canal.intervaloMin || 0) - (b.canal.intervaloMin || 0));

        if (!conReloj.length) {
            return `
            <section class="eq-block">
                <h3 class="eq-block__title">⏳ A quién esperar</h3>
                <p class="eq-block__hint eq-block__hint--vacio">Ningun agente tiene un heartbeat configurado.</p>
            </section>`;
        }

        const filas = conReloj.map(s => {
            const falta = (s.canal.intervaloMin || 0) - s.ageMin;
            const atrasado = s.ageMin !== Infinity && falta <= 0;
            const clase = atrasado ? 'eq-espera__cuando--atrasado' : 'eq-espera__cuando';

            // Por qué dice "última señal" y no "última corrida": el reloj corre
            // sobre la última señal REGISTRADA (un commit o una mención en
            // SESSION_LOG). Un heartbeat que corre y no registra nada es
            // indistinguible de uno que no corrió, y la API de crons no expone
            // last_run. Afirmar "se pasó" sería inventar la causa; se muestra
            // el dato y la aritmética, que es lo que se puede saber.
            const senal = s.ageMin === Infinity ? 'sin señal' : `hace ${this._formatAge(s.ageMin).replace('hace ', '')}`;
            const nota = s.ageMin === Infinity
                ? 'sin registro en commits ni SESSION_LOG'
                : (atrasado
                    ? `tocaba hace ${this._formatAge(-falta).replace('hace ', '')}`
                    : `vuelve en ${this._formatAge(falta).replace('hace ', '')}`);

            return `
            <tr>
                <td class="eq-who__agente">${s.icon} ${this._escape(s.nombre)}</td>
                <td class="eq-espera__cuando ${clase}">${senal}<span class="eq-espera__sub">${nota}</span></td>
                <td class="eq-espera__nota">${s.canal.activo ? 'cada ' + this._formatAge(s.canal.intervaloMin).replace('hace ', '') : ''}</td>
            </tr>`;
        }).join('');

        const porDemanda = statuses.filter(s => !s.canal.activo)
            .map(s => `${s.nombre}, cuando lo llames`).join(' · ');

        return `
        <section class="eq-block">
            <h3 class="eq-block__title">⏳ A quién esperar</h3>
            <p class="eq-block__hint">
                Si algo no avanza, esto es lo primero que hay que mirar: casi siempre es que
                todavía no le tocaba.
            </p>
            <div class="eq-table-wrap">
                <table class="eq-table eq-table--espera">
                    <thead><tr><th>Agente</th><th>Última señal</th><th>Cada cuánto</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <p class="eq-block__hint eq-block__hint--vacio">
                <strong>Sin reloj:</strong> ${this._escape(porDemanda)}
            </p>
            <p class="eq-block__nota">
                El reloj corre sobre la última señal <em>registrada</em> (un commit o una mención
                en SESSION_LOG), no sobre la última ejecución: un heartbeat que corre sin
                registrar nada hoy es indistinguible de uno que no corrió. Por eso la columna
                dice "última señal" y no "se pasó".
            </p>
        </section>`;
    }

    /** "cada 30 min" / "bajo demanda" / "sin dato". */
    static _cadaCuando(s) {
        if (!s.canal.activo) return 'bajo demanda';
        if (!s.canal.intervaloMin) return 'sin dato';
        return `cada ${this._formatAge(s.canal.intervaloMin).replace('hace ', '')}`;
    }

    /**
     * Calcula el estado de cada agente.
     */
    static _computeStatus(agent, data) {
        const now = Date.now();

        // 1) Último commit relacionado a este agente
        let lastCommit = null;
        let lastCommitTs = 0;
        const commits = data.commits || [];
        commits.forEach(c => {
            const msg = c.commit?.message || '';
            const scopeMatch = msg.match(/\(([^)]+)\)/);
            const scope = scopeMatch ? scopeMatch[1].toLowerCase() : '';
            if (agent.scopes.some(s => scope.includes(s) || msg.toLowerCase().includes(s))) {
                const ts = new Date(c.commit?.author?.date || 0).getTime();
                if (ts > lastCommitTs) {
                    lastCommitTs = ts;
                    lastCommit = c;
                }
            }
        });

        // 2) Última mención en SESSION_LOG
        let lastMentionTs = 0;
        const sessionLog = data.sessionLog || '';
        const agentName = (agent.nombre || '').toLowerCase().split(' ')[0];
        const logLines = sessionLog.split('\n');
        logLines.forEach(line => {
            const tsMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\]/);
            if (tsMatch && new RegExp(agentName, 'i').test(line)) {
                const ts = new Date(tsMatch[1]).getTime();
                if (ts > lastMentionTs) lastMentionTs = ts;
            }
        });

        const lastActivity = Math.max(lastCommitTs, lastMentionTs);
        const ageMs = lastActivity ? now - lastActivity : Infinity;
        const ageMin = ageMs / 60000;

        // 3) Canal real del agente (viene verificado, no estimado)
        const canal = this._canalDe(agent, data.structure);

        // 4) Estado de actividad.
        //
        // FIX: una alerta ya NO decide que un agente está CAÍDO. Antes sí:
        // bastaba con que el nombre del agente apareciera en el texto de una
        // alerta (el parser metía la descripción entera en el campo `agent`),
        // así que PO, Reviewer y Documentador salían en rojo teniendo
        // actividad de hace menos de una hora. Una alerta es un problema
        // registrado; un heartbeat vencido es otra cosa. Se confundían.
        //
        // CAÍDO pasa a significar lo único que significa: tiene un heartbeat
        // configurado, pasó más del doble de su ventana, y no hubo actividad.
        // Un agente bajo demanda (sin heartbeat) no puede estar CAÍDO nunca:
        // no tiene nada que vencerse.
        let status = 'unknown';
        let statusMotivo = '';

        // El umbral es el INTERVALO (cada cuánto debería correr), no el
        // timeout de una corrida. Piso de 180 min por una razón concreta: el
        // Principal corre cada 30 min pero no commitea en cada heartbeat, así
        // que con un umbral puro de 45 min aparecería CAÍDO por ser
        // productivo de otra forma. El silencio no es prueba de caída: es la
        // ausencia de un dato. A los 3h sin actividad, sí lo es.
        const umbralMin = Math.max((canal.intervaloMin || canal.ventanaMin) * 1.5, 180);
        const umbralTxt = canal.intervaloMin
            ? 'debería correr cada ' + this._formatAge(canal.intervaloMin).replace('hace ', '')
            : 'ventana ' + Math.round(canal.ventanaMin) + ' min';

        if (ageMin === Infinity) {
            status = 'unknown';
            statusMotivo = 'Sin actividad registrada en commits ni SESSION_LOG';
        } else if (canal.activo && ageMin > umbralMin) {
            status = 'error';
            statusMotivo = 'Heartbeat vencido: ' + this._formatAge(ageMin)
                + ' sin actividad, y ' + umbralTxt;
        } else if (canal.activo && ageMin < 10) {
            status = 'active';
        } else if (canal.activo && ageMin < canal.ventanaMin) {
            status = 'heartbeat';
        } else {
            status = 'idle';
        }

        // 5) Texto de "qué está haciendo".
        // El BOM se quita: 5 de los últimos 6 commits del repo lo traen
        // escrito al principio del mensaje, y sale como un caracter invisible
        // pegado al texto. No es culpa del render, es del que escribe.
        let currentActivity = 'Sin actividad reciente';
        if (lastCommitTs === lastActivity && lastCommit) {
            const msg = (lastCommit.commit?.message || '').replace(/^\uFEFF/, '').split('\n')[0];
            currentActivity = `Último commit: ${this._truncate(msg, 80)}`;
        } else if (lastMentionTs === lastActivity) {
            currentActivity = 'Mencionado en SESSION_LOG';
        }

        return {
            agent,
            nombre: agent.nombre,
            icon: agent.icon,
            queDecide: agent.queDecide,
            status,
            statusMotivo,
            canal,
            lastActivity,
            ageMin,
            currentActivity,
            lastCommit
        };
    }

    /**
     * Cada cuántos MINUTOS debería correr este agente.
     *
     * Distinto de timeout_s, que es cuánto se le permite tardar UNA corrida.
     * Confundir las dos dos cosas es lo que producía los CAÍDO falsos: el
     * Documentador corre cada 240 min con un timeout de 15, así que usar el
     * timeout como ventana lo daba por muerto a los 31 minutos de inactividad.
     */
    static _intervaloMin(hb) {
        // Cron: "*/30 * * * *" o "0,30 * * * *"
        if (hb.cron_expr) {
            const paso = String(hb.cron_expr).match(/^\*\/(\d+)/);
            if (paso) return parseInt(paso[1], 10);
            const cada = String(hb.cron_expr).match(/^\d+\s*,\s*(\d+)/);
            if (cada) return Math.max(1, 60 - parseInt(cada[1], 10));
        }
        // agent.json: "30m", "2h", "6h". El flag enabled se mira a propósito:
        // el Code Reviewer declara every=6h con agent_json_enabled=false, y
        // un intervalo que no está configurado no es un intervalo.
        if (hb.agent_json_enabled && hb.agent_json_every) {
            const m = String(hb.agent_json_every).trim().match(/^(\d+)\s*(m|h|d)?$/i);
            if (m) {
                const n = parseInt(m[1], 10);
                const u = (m[2] || 'm').toLowerCase();
                return u === 'h' ? n * 60 : (u === 'd' ? n * 1440 : n);
            }
        }
        return null;
    }

    /**
     * Canal real del agente, leido de data/estructura.json (verificado por el
     * Arquitecto contra agent.json + qwenpaw cron list + procesos vivos).
     *
     * No inventa: si el JSON no llego, dice "sin dato" en vez de asumir.
     * `intervaloMin` es cada cuánto debería correr; `ventanaMin` queda como
     * el timeout de la corrida y se usa solo de respaldo.
     */
    static _canalDe(agent, structure) {
        const filas = (structure && structure.agentes) || [];
        const fila = filas.find(a => a.id === agent.refAgente);
        if (!fila) {
            return { activo: false, intervaloMin: null, ventanaMin: 360, texto: 'Canal: sin dato (estructura no cargada)', tono: 'neutro' };
        }

        const hb = fila.heartbeat || {};
        const esEcosistema = !fila.id.startsWith('QwenPaw_');
        const intervaloMin = this._intervaloMin(hb);
        const timeoutMin = hb.timeout_s ? hb.timeout_s / 60 : null;
        const ventanaMin = intervaloMin || timeoutMin || 360;

        // Guarda explícita. `mecanismo` y `cron_expr` describen lo que EXISTE,
        // no lo que CORRE: un cron deshabilitado sigue teniendo id y expr. El
        // Arquitecto tuvo la sonda apagada horas y el dashboard la anunciaba
        // como "corre cada 30 min" porque nadie miró `enabled`. Este chequeo
        // es la defensa por si alguien reactiva un cron sin refrescar el JSON.
        if (hb.activo === false) {
            return {
                activo: false,
                intervaloMin: null,
                ventanaMin: 360,
                texto: 'Canal: ' + (hb.texto_canal || 'sin heartbeat activo'),
                tono: 'neutro'
            };
        }

        if (hb.mecanismo === 'cron' && hb.cron_expr) {
            return {
                activo: esEcosistema,
                intervaloMin,
                ventanaMin,
                texto: 'Canal: cron ' + hb.cron_expr + ' UTC' + (hb.proposito ? ' (' + hb.proposito + ')' : ''),
                tono: 'ok'
            };
        }
        if (hb.agent_json_enabled) {
            return {
                activo: true,
                intervaloMin,
                ventanaMin,
                texto: 'Canal: heartbeat ' + hb.agent_json_every + ' (agent.json)',
                tono: 'ok'
            };
        }
        if (hb.mecanismo === 'ninguno') {
            return {
                activo: false,
                intervaloMin: null,
                ventanaMin: 360,
                texto: 'Canal: sin heartbeat, bajo demanda',
                tono: 'neutro'
            };
        }
        return {
            activo: false,
            intervaloMin: null,
            ventanaMin: 360,
            texto: 'Canal: ' + (hb.mecanismo || 'desconocido'),
            tono: 'neutro'
        };
    }

    static _cardHTML(s) {
        const statusLabel = this._statusLabel(s.status);
        const canal = s.canal;
        const statusEmoji = this._statusEmoji(s.status);
        const ageText = s.ageMin === Infinity ? 'sin data' : this._formatAge(s.ageMin);
        // FIX: "Último commit: hace 2h" salía dos veces en la tarjeta (aquí y en
        // la línea de actividad, que ya trae el mensaje del commit). El dato
        // no era repetido por descuido: la tarjeta mostraba la EDAD del commit
        // arriba y el MENSAJE abajo, dos vistas del mismo hecho.

        return `
            <div class="live-card live-card--${s.status}">
                <div class="live-card__header">
                    <span class="live-card__icon">${s.agent.icon}</span>
                    <span class="live-card__name">${this._escape(s.agent.nombre)}</span>
                </div>
                <div class="live-card__status">
                    <span class="live-card__status-emoji">${statusEmoji}</span>
                    <span class="live-card__status-label">${statusLabel}</span>
                </div>
                <div class="live-card__activity">${this._escape(s.currentActivity)}</div>
                ${s.status === 'error' && s.statusMotivo
                    ? `<div class="live-card__motivo">${this._escape(s.statusMotivo)}</div>`
                    : ''}
                <div class="live-card__meta">
                    <span class="live-card__canal live-card__canal--${canal.tono}">${this._escape(canal.texto)}</span>
                    <span>Última actividad: ${ageText}</span>
                </div>
            </div>
        `;
    }

    static _statusLabel(status) {
        const map = {
            'active': 'ACTIVO',
            'heartbeat': 'HEARTBEAT',
            'idle': 'IDLE',
            'error': 'CAÍDO',
            'unknown': 'SIN DATA'
        };
        return map[status] || 'SIN DATA';
    }

    static _statusEmoji(status) {
        const map = {
            'active': '🟢',
            'heartbeat': '🟡',
            'idle': '⚫',
            'error': '🔴',
            'unknown': '❔'
        };
        return map[status] || '❔';
    }

    static _formatAge(min) {
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${Math.floor(min)} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `hace ${h}h`;
        const d = Math.floor(h / 24);
        return `hace ${d}d`;
    }

    static _truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    static _escape(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[m];
        });
    }
}
