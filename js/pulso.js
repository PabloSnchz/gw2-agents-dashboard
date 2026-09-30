/**
 * js/pulso.js
 * Tab "Resumen" — el pulso del PROYECTO de un vistazo.
 *
 * Que cambia respecto al Resumen anterior:
 *
 * 1) No abre con la proteccion de ramas. Eso es estructura, no pulso, y
 *    vive en el tab Estructura. Ademas "produccion protegida" sonaba a
 *    garantia de seguridad, y no lo es: nadie la toco porque esta fuera
 *    del alcance de todo agente, no porque GitHub la este defendiendo.
 *
 * 2) No muestra mas "AGENTES 0/0" ni "COMMS 0". Venian de parsear
 *    TEAM_STATUS.md, que no tiene esos datos en un formato que el parser
 *    entendiera: el parser devolvia 0 y el dashboard lo pintaba como un
 *    cero real. Un 0 que significa "no se" no es informacion, es ruido con
 *    apariencia de dato. Ahora cada KPI sale de un archivo que SI tiene el
 *    dato (health_check.py -> data/salud.json), y cuando no se pudo leer
 *    se muestra "—" con el motivo, nunca 0.
 *
 * 3) Arriba va DONDE ESTA EL TRABAJO: ramas vivas, items esperando tu
 *    decision, backlog bloqueado. Eso es lo que se pregunta uno al abrir
 *    el panel. Los numeros de estructura quedan para el tab Estructura.
 *
 * REGLA: este modulo no propone promover NADA. Cuenta y nombra. La
 * promocion a produccion la decide Pablo.
 */

const Pulso = {
    data: null,
    _err: null,

    async load() {
        const cfg = window.DASHBOARD_CONFIG;
        if (!cfg || !cfg.getHealthUrl) return;
        try {
            const res = await fetch(cfg.getHealthUrl() + '?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = await res.json();
            this._err = null;
        } catch (e) {
            this.data = null;
            this._err = e.message;
        }
        this.render();
    },

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** Un valor que no se pudo leer se ve como "—", jamas como 0. */
    _kpi(label, valor, sub, tono) {
        const v = valor == null ? '—' : valor;
        return '<div class="pulso-kpi' + (tono ? ' pulso-kpi--' + tono : '') + '">' +
            '<span class="pulso-kpi__label">' + this._esc(label) + '</span>' +
            '<span class="pulso-kpi__value">' + this._esc(v) + '</span>' +
            '<span class="pulso-kpi__sub">' + this._esc(sub || '') + '</span>' +
            '</div>';
    },

    /** El sub de un KPI dice POR QUE es "—", no "0". */
    _motivo(bloque, clave) {
        if (bloque != null) return '';
        return 'sin dato: ' + this._esc(clave);
    },

    render() {
        this._renderCabecera();
        this._renderKpis();
        this._renderIncidencias();
        this._renderTrabajo();
    },

    // ------------------------------------------------------------------
    _renderCabecera() {
        const c = document.getElementById('pulso-cabecera');
        if (!c) return;
        if (!this.data) {
            c.innerHTML = '<p class="org-callout org-callout--warn">Sin datos: ' +
                this._esc(this._err || 'no se pudo leer data/salud.json') +
                ' — el chequeo corre cada 30 min. Si el panel dice esto, el dato ' +
                '<em>no se conoce</em>; no es que no haya nada.</p>';
            return;
        }
        c.innerHTML = '<p class="org-source">Medido el <strong>' +
            this._esc(this.data.generado_h) + '</strong> por <code>health_check.py</code>, ' +
            'sin gastar un solo token. Sale de <code>IN_PROGRESS.md</code>, ' +
            '<code>READY_FOR_PROMOTION.md</code>, <code>BACKLOG.md</code> y los ' +
            '<code>agent.json</code> reales.</p>';
    },

    // ------------------------------------------------------------------
    _renderKpis() {
        const c = document.getElementById('pulso-kpis');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }

        const p = this.data.proyecto || {};
        const r = p.ramas, promo = p.esperando_decision,
              b = p.backlog, ag = p.agentes;

        // Agentes: "5/5" es real (los 5 agent.json del equipo con modelo).
        // El QA builtin va aparte, no dentro del 5: contarlo inflaria el
        // numero y ademas no participa de ningun flujo.
        let agentesVal = null, agentesSub;
        if (ag) {
            const todosOk = ag.operativos === ag.equipo;
            agentesVal = ag.operativos + '/' + ag.equipo;
            agentesSub = todosOk
                ? 'todo operativo' + (ag.builtin && ag.builtin.length ? ' (+1 builtin)' : '')
                : (ag.equipo - ag.operativos) + ' sin modelo';
        } else {
            agentesSub = this._motivo(ag, p.agentes_error);
        }

        let ramasSub = '';
        if (r) {
            const e = r.por_estado || {};
            // Solo las que SUMAN el numero de arriba. La version anterior
            // metia tambien "2 cerradas · 1 descartable" al lado de un 6,
            // y un lector que suma las partes y obtiene 9 no sabe cual de
            // los dos numeros es el bueno. Las cerradas y la descartable
            // se dicen aparte, con la palabra que aclara que NO cuentan.
            const partes = [];
            if (e.en_curso) partes.push(e.en_curso + ' en curso');
            if (e.aprobada) partes.push(e.aprobada + ' aprobada');
            if (e.pusheada) partes.push(e.pusheada + ' pusheada');
            if (e.abierta)   partes.push(e.abierta + ' por abrir');
            const fuera = [];
            if (e.cerrada)     fuera.push(e.cerrada + ' cerradas');
            if (e.descartable) fuera.push(e.descartable + ' descartable');
            ramasSub = (partes.join(' · ') || 'sin detalle') +
                       (fuera.length ? ' (+' + fuera.join(', ') + ', sin contar)' : '');
        } else {
            ramasSub = this._motivo(r, p.ramas_error);
        }

        let promoSub = '';
        if (promo) {
            promoSub = promo.con_condicion
                ? promo.con_condicion + ' con condicion (no promover aun)'
                : 'listos, vos decidis';
        } else {
            promoSub = this._motivo(promo, p.esperando_decision_error);
        }

        let backVal = null, backSub;
        if (b) {
            backVal = b.abiertos;
            backSub = b.bloqueados
                ? b.bloqueados + ' bloqueado(s) — esperando token o veredicto'
                : 'ninguno bloqueado';
        } else {
            backSub = this._motivo(b, p.backlog_error);
        }

        c.innerHTML =
            this._kpi('Ramas vivas', r ? r.vivas : null, ramasSub,
                      r ? (r.vivas > 0 ? 'info' : 'ok') : null) +
            this._kpi('Esperando tu decision', promo ? promo.total : null, promoSub,
                      promo && promo.total > 0 ? 'warn' : 'ok') +
            this._kpi('Backlog abierto', backVal, backSub,
                      b && b.bloqueados ? 'warn' : 'ok') +
            this._kpi('Agentes', agentesVal, agentesSub,
                      ag ? (ag.operativos === ag.equipo ? 'ok' : 'warn') : null);
    },

    // ------------------------------------------------------------------
    // Incidencias: una linea cada una, con el detalle bajo demanda.
    // Antes esto eram 3 bloques con tarjetas y parrafos; ocupaba mas
    // pantalla que el resto del tab y las alertas tecnicas tapaban el
    // estado real del trabajo.
    _renderIncidencias() {
        const c = document.getElementById('pulso-incidencias');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }

        const p = this.data.proyecto || {};
        const items = [];

        // 1) Logs del equipo que no se refrescan: el sintoma mas temprano
        //    de que un heartbeat dejo de correr.
        (this.data.archivos_estado || [])
            .filter(s => s.estado !== 'ok')
            .forEach(s => items.push({
                sev: s.estado === 'ROTO' ? 'alta' : 'media',
                txt: s.archivo + ' sin refrescar hace ' +
                     (s.edad_h != null ? s.edad_h + ' h' : '?'),
                detail: 'Lo escribe ' + s.quien +
                         '. Si no se refresca, ese heartbeat no esta corriendo.' +
                         (s.crecimiento ? ' Ademas: ' + s.crecimiento : ''),
            }));

        // 2) Backlog bloqueado: trabajo parado por algo que no se resuelve
        //    solo (falta un token de API, falta un veredicto del Reviewer).
        const b = p.backlog;
        (b && b.bloqueados_items ? b.bloqueados_items : []).forEach(t => items.push({
            sev: 'media',
            txt: 'Bloqueado: ' + t,
            detail: 'El bloqueo esta anotado en BACKLOG.md. Es trabajo del equipo, ' +
                    'no un problema del dashboard.',
        }));

        // 3) Ramas que el equipo ya sabe que sobran.
        const r = p.ramas;
        if (r) {
            (r.ramas || []).filter(x => x.estado === 'descartable').forEach(x => items.push({
                sev: 'baja',
                txt: 'Rama descartable: ' + x.rama,
                detail: x.estado_txt || 'El equipo la marco como redundante.',
            }));
        }

        // 4) Items que esperan con una condicion puesta por el equipo.
        const promo = p.esperando_decision;
        if (promo) {
            (promo.items || []).filter(x => x.condicion).forEach(x => items.push({
                sev: 'baja',
                txt: 'Item con condicion: ' + x.item,
                detail: x.condicion,
            }));
        }

        if (!items.length) {
            c.innerHTML = '<p class="cc-empty">Sin incidencias abiertas. ' +
                'Los heartbeats refrescan sus logs y nada del backlog esta bloqueado.</p>';
            return;
        }

        // Mas graves primero.
        const orden = { alta: 0, media: 1, baja: 2 };
        items.sort((a, b2) => orden[a.sev] - orden[b2.sev]);

        c.innerHTML = '<ul class="inc-list">' + items.map(i =>
            '<li class="inc inc--' + i.sev + '">' +
            '<details><summary><span class="inc__sev">' + this._esc(i.sev) + '</span>' +
            '<span class="inc__txt">' + this._esc(i.txt) + '</span></summary>' +
            '<p class="inc__detail">' + this._esc(i.detail) + '</p></details></li>'
        ).join('') + '</ul>';
    },

    // ------------------------------------------------------------------
    // El trabajo, nombrado. Sin esto el Resumen dice cuantos hay pero no
    // cuales, y "6 ramas vivas" no es accionable.
    _renderTrabajo() {
        const c = document.getElementById('pulso-trabajo');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }

        const p = this.data.proyecto || {};
        const r = p.ramas, promo = p.esperando_decision;
        const out = [];

        if (r) {
            // Solo trabajo VIVO. La version anterior listaba tambien las
            // descartables, y eso son dos males: el encabezado decia
            // "Ramas activas (7)" mientras el KPI de arriba decia 6 (el
            // KPI no cuenta las descartables), y la misma rama aparecia
            // dos veces en pantalla, como incidencia y como trabajo. Un
            // numero que contradice a otro cercano es peor que no
            // mostrar ninguno: entrena al ojo a desconfiar de los dos.
            // La descartable ya sale en "Incidencias abiertas".
            const vivas = (r.ramas || []).filter(x => x.estado !== 'cerrada'
                                                    && x.estado !== 'descartable');
            if (vivas.length) {
                out.push('<h4>Ramas activas (' + vivas.length + ')</h4>' +
                    '<p class="org-source">Lo que el equipo tiene en manos ahora, ' +
                    'sacando lo cerrado y lo que el equipo ya dio por sobrante ' +
                    '(eso sale arriba, en incidencias).</p>' +
                    '<ul class="trab-list">' + vivas.map(x =>
                        '<li class="trab trab--' + (x.estado || 'sin_clasificar') + '">' +
                        '<code class="trab__rama">' + this._esc(x.rama) + '</code>' +
                        '<span class="trab__item">' + this._esc(x.item) + '</span>' +
                        '<span class="trab__estado">' + this._esc(x.estado_txt) + '</span>' +
                        '</li>').join('') + '</ul>');
            }
        }

        if (promo && (promo.items || []).length) {
            out.push('<h4>Esperando tu decision (' + promo.total + ')</h4>' +
                '<p class="org-source">Terminado y en <code>agents/main</code>. ' +
                '<strong>Nadie lo promueve sin que lo pidas</strong> — ni siquiera ' +
                'este panel.</p>' +
                '<ul class="trab-list">' + promo.items.map(x =>
                    '<li class="trab trab--' + (x.condicion ? 'condicion' : 'listo') + '">' +
                    '<span class="trab__item">' + this._esc(x.item) + '</span>' +
                    (x.commits ? '<code class="trab__sha">' + this._esc(x.commits) + '</code>' : '') +
                    (x.condicion ? '<span class="trab__estado">' + this._esc(x.condicion) + '</span>' : '') +
                    '</li>').join('') + '</ul>');
        }

        c.innerHTML = out.join('') ||
            '<p class="cc-empty">Sin ramas activas ni items esperando decision.</p>';
    }
};

window.Pulso = Pulso;
