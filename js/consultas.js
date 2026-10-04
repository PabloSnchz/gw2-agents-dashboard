/**
 * js/consultas.js — tab "Consultas del Arquitecto"
 * =============================================================================
 * POR QUÉ EXISTE ESTA TAB
 *
 * Pablo, 2026-10-04, textual:
 *   "los agentes no deberían validar conmigo, ellos deberían hablar con vos, y
 *    si vos lo considera, tendrías que tener un apartado en el dashboard donde
 *    me haces consultas a mi, entonces para mí es más fácil responder"
 *
 * El problema que corrige, medido: hoy el equipo le pregunta a Pablo
 * directamente y lo que llega a IN_PROGRESS.md como "falta el icono
 * assets/icons/Cuentas/homestead-icon" NO era una decisión suya: era un deadlock
 * técnico disfrazado de decisión de producto. Ya pasó tres veces (ALERT-49, el
 * falso "Documentador desactivado", y esto). Cada vez Pablo vio algo que
 * parecía suyo y no lo era.
 *
 * POR QUÉ NO TOCO renderer.js
 *
 * renderer.js dibuja las 8 tabs existentes. Agregar un método ahí es un cambio
 * en el archivo que todos tocan, por un tab que es nuevo. Si el método nuevo
 * tiene un error de sintaxis, no se rompe "Consultas": se rompen las 8. Este
 * módulo es autónomo y solo escribe en sus propios containers.
 *
 * EL CONTRATO DEL DATO (data/consultas.json)
 *
 * Todo es opcional y todo degrada a un estado honesto. Un campo faltante
 * produce "—", no una sección en blanco: una tab vacía es indistinguible de
 * "no hay nada", y esa es exactamente la confusión que hay que evitar.
 *
 *   {
 *     "generado":  "20261004T233000Z",
 *     "regla":     "texto de la regla de filtrado (opcional)",
 *     "para_pablo":[ { id, agente, pregunta, bloqueante, opciones[], due,
 *                     estado, respuesta?, respuesta_fecha?, origen } ],
 *     "resueltas_architecto": [ { id, agente, pregunta, resolucion, estado } ],
 *     "del_equipo": [ { id, agente, pregunta, estado, resuelto_por, fecha } ]
 *   }
 *
 * Los DUE se comparan como STRING COMPACTO (YYYYMMDDTHHMMSSZ), no como ISO con
 * guiones: '_' es ASCII 95 y va DESPUÉS de todos los dígitos, así que "2026-…"
 * comparado contra "2026…" da siempre vencido. Mismo reloj usa el exportador del
 * canal de comunicaciones. Documentado acá porque es el segundo vez que lo
 * escribo y la primera me costó una tanda de falsos "overdue".
 */
(function () {
    'use strict';

    // _renderer() con guarda por binding LÉXICO: renderer.js declara
    // "class DashboardRenderer", que crea un binding del scope global, no una
    // propiedad de window. Chequear window.X da undefined siempre.
    // Este módulo NO usa el renderer: renderiza solo. La función se queda
    // igual por si alguna vez hace falta delegar.
    function _renderer() {
        if (typeof DashboardRenderer !== 'undefined') return DashboardRenderer;
        return (typeof window !== 'undefined') ? window.DashboardRenderer : null;
    }

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Reloj de contrato: UTC compacto. Se usa para TODO cálculo de vencimiento.
    // Un solo lugar, para que "v encida" no dependa de qué función preguntó.
    function _ahora() {
        return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    }

    function _vence(due) {
        // Sin DUE no se marca vencida. Una consulta sin plazo no es una consulta
        // vencida: es una consulta mal declarada, y se ve como tal abajo.
        if (!due || typeof due !== 'string') return null;
        return due < _ahora();
    }

    function _cfg() {
        return (typeof window !== 'undefined') ? window.DASHBOARD_CONFIG : null;
    }

    // -------------------------------------------------------------------------
    // Bloque para pegar en el chat del Arquitecto.
    //
    // Esto es lo que Pablo copia. Va numerado para que responda "2" y no tenga
    // que escribir: la fricción de escribir es la razón por la que las
    // respuestas Roberts en unanswered.
    // -------------------------------------------------------------------------
    function _textoParaCopiar(c) {
        var out = [];
        out.push('CONSULTA ' + (c.id || '(sin id)'));
        if (c.agente) out.push('agente: ' + c.agente);
        out.push('');
        out.push(c.pregunta || '');
        if (c.bloqueante) {
            out.push('');
            out.push('bloqueante: ' + c.bloqueante);
        }
        var ops = c.opciones || [];
        if (ops.length) {
            out.push('');
            out.push('respondé con el número:');
            for (var i = 0; i < ops.length; i++) {
                out.push('  ' + (i + 1) + '. ' + ops[i]);
            }
        }
        if (c.due) {
            out.push('');
            out.push('vence: ' + c.due);
        }
        return out.join('\n');
    }

    function _copiar(texto, btn) {
        var ok = function () {
            if (!btn) return;
            var previo = btn.textContent;
            btn.textContent = '✓ Copiado';
            btn.classList.add('consulta__btn-copiar--hecho');
            setTimeout(function () {
                btn.textContent = previo;
                btn.classList.remove('consulta__btn-copiar--hecho');
            }, 2200);
        };
        var fallback = function () {
            // clipboard.writeText no existe en http:// ni sin permiso. Sin este
            // fallback el botón falla en silencio y Pablo cree que copió.
            var ta = document.createElement('textarea');
            ta.value = texto;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            var ex = false;
            try { ex = document.execCommand('copy'); } catch (e) { ex = false; }
            document.body.removeChild(ta);
            if (ex) ok();
            else window.alert('No se pudo copiar automáticamente. Texto:\n\n' + texto);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(ok, fallback);
        } else {
            fallback();
        }
    }

    // -------------------------------------------------------------------------
    // Render de una card
    // -------------------------------------------------------------------------
    function _card(c) {
        var vence = _vence(c.due);
        var estado = c.estado || (vence ? 'vencida' : 'esperando');

        // Vencida por reloj pisa al estado declarado: si el DUE pasó, está
        // vencida, diga lo que diga el archivo. Al revés también: una consulta
        // cerrada no se revive porque su DUE siga en el futuro.
        if (estado === 'abierta' || estado === 'esperando') {
            estado = vence ? 'vencida' : 'esperando';
        }

        var h = [];
        h.push('<article class="consulta consulta--' + _esc(estado) + '">');

        h.push('<div class="consulta__meta">');
        if (c.agente) {
            h.push('<span class="consulta__agente">' + _esc(c.agente) + '</span>');
        }
        h.push('<span class="consulta__badge consulta__badge--' + _esc(estado) + '">'
            + _esc(estado) + '</span>');
        if (c.origen) {
            h.push('<span>origen: ' + _esc(c.origen) + '</span>');
        }
        if (c.due) {
            h.push('<span>vence ' + _esc(c.due) + (vence ? ' (pasado)' : '') + '</span>');
        } else {
            h.push('<span>sin plazo</span>');
        }
        h.push('</div>');

        h.push('<p class="consulta__pregunta">' + _esc(c.pregunta) + '</p>');

        if (c.bloqueante) {
            h.push('<div class="consulta__bloqueante">' + _esc(c.bloqueante) + '</div>');
        }

        var ops = c.opciones || [];
        if (ops.length) {
            h.push('<ul class="consulta__opciones">');
            for (var i = 0; i < ops.length; i++) {
                h.push('<li class="consulta__opcion">' + _esc(ops[i]) + '</li>');
            }
            h.push('</ul>');
        }

        if (c.respuesta) {
            h.push('<div class="consulta__respuesta">');
            h.push('<span class="consulta__respuesta__quien">respondió '
                + _esc(c.respondio || 'Pablo') + (c.respuesta_fecha ? ' el ' + _esc(c.respuesta_fecha) : '')
                + '</span>');
            h.push(_esc(c.respuesta));
            h.push('</div>');
        }

        // Solo las que esperan a Pablo llevan botón de copiar. Una consulta ya
        // respondida o vencida no se copia: copiaría algo que ya no hay que
        // decidir, y eso es una fuente nueva de respuestas viejas.
        if (estado === 'esperando') {
            h.push('<div class="consulta__acciones">');
            h.push('<button type="button" class="consulta__btn-copiar" '
                + 'data-consulta-idx="__IDX__">Copiar para responder</button>');
            h.push('<span class="consulta__hint">Respondé al Arquitecto con el número. '
                + 'La respuesta llega al equipo por mí, no directo.</span>');
            h.push('</div>');
        }

        h.push('</article>');
        return h.join('');
    }

    // -------------------------------------------------------------------------
    // Render principal
    // -------------------------------------------------------------------------
    function render(datos, error) {
        var c = document.getElementById('consultas-container');
        if (!c) return;

        if (error) {
            c.innerHTML = '<div class="consultas-error">'
                + 'No se pudo cargar data/consultas.json.<span class="consultas-error__detalle">'
                + _esc(error) + '</span></div>'
                + '<p class="consultas-seccion__nota">La tab muestra el error en vez de quedar '
                + 'blanca: una tab vacía es indistinguible de "no hay consultas", y eso es '
                + 'justo lo que no se debe ver cuando el dato no llegó.</p>';
            return;
        }

        if (!datos) {
            c.innerHTML = '<div class="consultas-vacio">'
                + 'Todavía no hay <code>data/consultas.json</code>.<br>'
                + 'El generador corre cada 15 min con el pulso del ecosistema.</div>';
            return;
        }

        var paraPablo   = datos.para_pablo || [];
        var resueltas  = datos.resueltas_architecto || [];
        var delEquipo   = datos.del_equipo || [];

        var esperando = 0, vencidas = 0, respondidas = 0;
        for (var i = 0; i < paraPablo.length; i++) {
            var e = paraPablo[i].estado || '';
            var v = _vence(paraPablo[i].due);
            if (e === 'respondida' || e === 'cerrada') respondidas++;
            else if (e === 'abierta' || e === 'esperando') { if (v) vencidas++; else esperando++; }
        }

        var h = [];

        // La regla va PRIMERO y sin colapso. Pablo tiene que ver de un vistazo
        // que esta tab no es un buzón del equipo: es el mío, ya filtrado.
        if (datos.regla) {
            h.push('<div class="consultas-regla">');
            h.push('<div class="consultas-regla__titulo">Cómo funciona esta tab</div>');
            h.push('<p class="consultas-regla__texto">' + _esc(datos.regla) + '</p>');
            h.push('</div>');
        }

        h.push('<div class="consultas-tope">');
        h.push('<div class="consultas-metrica"><div class="consultas-metrica__num'
            + (esperando ? ' consultas-metrica__num--esperando' : '') + '">' + esperando
            + '</div><div class="consultas-metrica__label">esperando tu respuesta</div></div>');
        h.push('<div class="consultas-metrica"><div class="consultas-metrica__num'
            + (vencidas ? ' consultas-metrica__num--vencida' : '') + '">' + vencidas
            + '</div><div class="consultas-metrica__label">vencidas: el plazo pasó y el equipo '
            + 'siguió con su default</div></div>');
        h.push('<div class="consultas-metrica"><div class="consultas-metrica__num'
            + (resueltas.length ? ' consultas-metrica__num--resuelta' : '') + '">' + resueltas.length
            + '</div><div class="consultas-metrica__label">resueltas por mí, sin preguntarte</div></div>');
        h.push('</div>');

        // --- Te pregunto ---
        h.push('<section class="consultas-seccion">');
        h.push('<h3 class="consultas-seccion__titulo">Te pregunto</h3>');
        if (paraPablo.length) {
            h.push('<p class="consultas-seccion__nota">Estas necesitan una decisión tuya. '
                + 'El equipo está bloqueado en ellas y ya tiene un default declarado por si '
                + 'vencen.</p>');
            for (var j = 0; j < paraPablo.length; j++) {
                h.push(_card(paraPablo[j]).replace('__IDX__', String(j)));
            }
        } else {
            h.push('<div class="consultas-vacio">Nada pendiente.<br>'
                + 'Si no hay nada acá, es porque lo resolví yo.</div>');
        }
        h.push('</section>');

        // --- Resueltas por mí ---
        if (resueltas.length) {
            h.push('<section class="consultas-seccion">');
            h.push('<details class="consultas-colapsable">');
            h.push('<summary>Resueltas por mí sin preguntarte (' + resueltas.length + ')</summary>');
            h.push('<p class="consultas-seccion__nota">El equipo preguntó y contesté yo. '
                + 'Está acá para que veas que hubo demanda y no te llegó: si esto crece mucho, '
                + 'el filtro está fallando y es problema mío.</p>');
            for (var r = 0; r < resueltas.length; r++) {
                h.push(_card(resueltas[r]));
            }
            h.push('</details></section>');
        }

        // --- Del equipo ---
        if (delEquipo.length) {
            h.push('<section class="consultas-seccion">');
            h.push('<details class="consultas-colapsable">');
            h.push('<summary>Consultas del equipo, en cualquier estado (' + delEquipo.length + ')</summary>');
            h.push('<p class="consultas-seccion__nota">Estado crudo de lo que declaró el equipo '
                + 'en CONSULTAS.md. Sirve para verificar que ninguna queda colgada: toda consulta '
                + 'tiene dueño, plazo y default.</p>');
            h.push('<ul class="consulta__opciones">');
            for (var d = 0; d < delEquipo.length; d++) {
                var q = delEquipo[d];
                h.push('<li class="consulta__opcion">'
                    + '<strong>' + _esc(q.estado || '—') + '</strong> · '
                    + _esc(q.agente || '—') + ' · ' + _esc(q.pregunta || q.id || '—')
                    + '</li>');
            }
            h.push('</ul>');
            h.push('</details></section>');
        }

        if (datos.generado) {
            h.push('<div class="consultas-frescura">datos generados ' + _esc(datos.generado) + '</div>');
        }

        c.innerHTML = '<div class="consultas-wrap">' + h.join('') + '</div>';

        // Botones: se enganchan por delegate, no onclick inline, porque los ids
        // se reasignan en cada render y el onclick inline queda apuntando al
        // índice viejo después de un re-render.
        var btns = c.querySelectorAll('[data-consulta-idx]');
        for (var b = 0; b < btns.length; b++) {
            (function (btn) {
                var idx = parseInt(btn.getAttribute('data-consulta-idx'), 10);
                var cons = paraPablo[idx];
                if (!cons) return;
                btn.addEventListener('click', function () {
                    _copiar(_textoParaCopiar(cons), btn);
                });
            })(btns[b]);
        }
    }

    // -------------------------------------------------------------------------
    // Carga
    // -------------------------------------------------------------------------
    function load() {
        var cfg = _cfg();
        var url = cfg && cfg.getConsultasUrl ? cfg.getConsultasUrl() : null;

        if (!url) {
            render(null, 'config.js no expone getConsultasUrl().');
            return;
        }

        fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                window.__consultas = data;
                render(data, null);
            })
            .catch(function (e) {
                // El fallo se propaga al render, no se traga: una tab en blanco
                // es indistinguible de "no hay nada".
                window.__consultas = null;
                render(null, (e && e.message) ? e.message : String(e));
            });
    }

    window.ConsultasArq = { load: load, render: render };
})();