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

    /**
     * Estado en vivo, en la misma lectura que las tarjetas de arriba:
     * un AGENTE es una COLUMNA y las tres dimensiones son FILAS.
     *
     * Antes eran tres bloques -- dos tablas y una grilla de tarjetas -- y
     * para responder "el Reviewer, ahora qué?" había que buscarlo en tres
     * lugares distintos y cruzarlos mentalmente. Peor: las tablas
     * ordenaban por intervalo, no por el reparto, así que la fila del
     * Reviewer no estaba debajo de su tarjeta de arriba.
     *
     * Ahora el bloque de "Disciplina del canal" y esta matriz comparten el
     * MISMO template de columnas (`--eq-rail` + 5 columnas) y el mismo
     * orden. Leer una columna de arriba abajo es leer un agente.
     *
     * El canal NO se fusiona con esto a propósito: la fila de arriba se
     * lee de a una tarjeta, y estas se leen de a una fila. Meterlas en el
     * mismo bloque obligaría a elegir una de las dos formas de leer y se
     * rompería la otra.
     */
    static render(data) {
        const container = document.getElementById('live-status-container');
        if (!container) return;

        // El orden es el de AGENTS, que es el mismo que usa
        // comms-channel.js para las tarjetas del canal. NO se sorts: casi
        // cualquier criterio de orden rompe la alineación con la fila de
        // arriba, y esa alineación es la razón de existir de la matriz.
        const status = this.AGENTS.map(a => this._computeStatus(a, data));
        const conReloj = status.filter(s => s.canal.activo).length;
        const porDemanda = status.length - conReloj;
        const sin = status.filter(s => !s.canal.activo).map(s => s.nombre);

        container.innerHTML = [
            '<p class="eq-matrix__leyenda"><strong>' + conReloj + '</strong> con reloj propio' +
                ' &middot; <strong>' + porDemanda + '</strong> bajo demanda (' +
                this._escape(sin.join(', ')) + ')' +
                '. El orden de las columnas es el mismo que las tarjetas del canal de arriba.</p>',
            '<div class="eq-matrix">',
                this._fila('\uD83E\uDDED', 'Qué decide', status.map(s => this._celdaQuien(s)).join('')),
                this._fila('\u26A1', 'Ahora', status.map(s => this._celdaAhora(s)).join('')),
                this._fila('\u23F1\uFE0F', 'Vuelve', status.map(s => this._celdaVuelve(s)).join('')),
            '</div>',
            '<p class="eq-block__nota">El reloj corre sobre la última señal <em>registrada</em>' +
                ' &mdash; un commit o una mención en SESSION_LOG &mdash;, no sobre la última' +
                ' ejecución: un heartbeat que corre sin registrar nada es indistinguible de uno' +
                ' que no corrió. Por eso la celda dice "última señal" y no "se pasó". Un agente' +
                ' sin reloj no puede estar CAÍDO: no tiene nada que vencerse.</p>'
        ].join('');
    }

    /** Una fila de la matriz: el riel con la etiqueta, y las 5 celdas. */
    static _fila(emoji, label, celdas) {
        return '<div class="eq-rail">' +
                   '<span class="eq-rail__emoji">' + emoji + '</span>' +
                   '<span class="eq-rail__label">' + this._escape(label) + '</span>' +
               '</div>' + celdas;
    }

    /**
     * "Qué decide": para qué existe cada uno. No cambia de un día a otro, y
     * por eso va arriba: es la fila que orienta antes de leer las otras dos.
     * Viene del AGENTS.md de cada agente, no de una opinion.
     */
    static _celdaQuien(s) {
        return '<div class="eq-cell eq-cell--que">' +
                 '<p class="eq-cell__texto">' + this._escape(s.queDecide) + '</p>' +
                 '<p class="eq-cell__pie">' + this._escape(this._cadaCuando(s)) + '</p>' +
               '</div>';
    }

    /** "Ahora": el estado, con su causa cuando hay una. */
    static _celdaAhora(s) {
        const motivo = (s.status === 'error' && s.statusMotivo)
            ? '<p class="eq-cell__pie eq-cell__pie--alerta">' + this._escape(s.statusMotivo) + '</p>'
            : '';
        return '<div class="eq-cell eq-cell--' + s.status + '">' +
                 '<div class="eq-cell__estado">' +
                   '<span class="eq-cell__emoji">' + this._statusEmoji(s.status) + '</span>' +
                   '<span class="eq-cell__estado-txt">' + this._statusLabel(s.status) + '</span>' +
                 '</div>' +
                 '<p class="eq-cell__texto">' + this._escape(s.currentActivity) + '</p>' +
                 motivo +
               '</div>';
    }

    /**
     * "Vuelve": lo único accionable de la tab. Un agente con reloj tiene
     * próxima corrida predecible; esa es la diferencia entre "el equipo
     * está roto" y "todavía no le tocaba".
     */
    static _celdaVuelve(s) {
        if (!s.canal.activo) {
            return '<div class="eq-cell eq-cell--ondemand">' +
                     '<div class="eq-cell__estado">' +
                       '<span class="eq-cell__emoji">&#9851;</span>' +
                       '<span class="eq-cell__estado-txt">' +
                         this._escape(this._cadaCuando(s)) + '</span>' +
                     '</div>' +
                     '<p class="eq-cell__pie">Sin reloj. Cuando lo llames.</p>' +
                   '</div>';
        }

        const int = s.canal.intervaloMin;
        const falta = int ? int - s.ageMin : null;
        const atrasado = falta !== null && s.ageMin !== Infinity && falta <= 0;
        const senal = s.ageMin === Infinity ? 'sin señal' : this._formatAge(s.ageMin);
        const nota = s.ageMin === Infinity
            ? 'sin registro en commits ni SESSION_LOG'
            : (falta === null
                ? 'sin intervalo configurado'
                : (atrasado
                    ? 'tocaba ' + this._formatAge(-falta)
                    : 'vuelve ' + this._formatAge(falta)));

        return '<div class="eq-cell eq-cell--' + (atrasado ? 'atrasado' : 'espera') + '">' +
                 '<div class="eq-cell__estado">' +
                   '<span class="eq-cell__emoji">' + (atrasado ? '&#9200;' : '&#9201;&#65039;') + '</span>' +
                   '<span class="eq-cell__estado-txt">' +
                     this._escape(this._cadaCuando(s)) + '</span>' +
                 '</div>' +
                 '<p class="eq-cell__texto">' + this._escape(senal) + '</p>' +
                 '<p class="eq-cell__pie">' + this._escape(nota) + '</p>' +
               '</div>';
    }

    /** "cada 30 min" / "bajo demanda" / "sin dato". */
    static _cadaCuando(s) {
        // El generador (_eco/gen_estructura.py) escribe texto_canal cuando un
        // agente esta apagado por DISEÑO y no por incidente. "bajo demanda"
        // a secas es correcto pero incompleto: no dice quién mantiene ese
        // canal ni por qué esta apagado. Si el dato existe, se muestra.
        if (!s.canal.activo) {
            const propio = s.canal.texto_canal || s.canal.textoCanal;
            return propio ? String(propio).replace(/\s*—\s*el mantenimiento.*$/, '') : 'bajo demanda';
        }
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
                // texto_canal se propaga como campo propio: _cadaCuando() lo
                // necesita para la columna "cada cuánto", que antes caia
                // siempre en la genérica "bajo demanda".
                texto_canal: hb.texto_canal || null,
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
