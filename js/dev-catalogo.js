/**
 * js/dev-catalogo.js — tab Promociones: "QUÉ CONSTRUYÓ EL EQUIPO Y DÓNDE SE VE"
 *
 * POR QUÉ EXISTE
 *
 * La tab Promociones contestaba una sola pregunta: qué está esperando decisión.
 * La que Pablo hacía era otra: "la armería legendaria, nunca la vi". La armería
 * SÍ existía y funcionaba — 206 legendarias con precios, item 8 del menú. Lo
 * que faltaba no era la funcionalidad: era el mapa. Y encima el mapa tenía que
 * servir para DECIDIR, no para archivar.
 *
 * POR QUÉ AGRUPA POR ACCIÓN Y NO POR TIPO
 *
 * La primera versión de esta propuesta agrupaba por tipo (nuevas / mejoras).
 * Es un error de uso: al abrir la tab la pregunta es "¿qué tengo que decidir
 * hoy?", no "quiero ver las mejoras". Con el tipo como grupo, una feature
 * pendiente y una ya promovida quedaban a 8 ítems de distancia y había que
 * buscarlas. Ahora el GRUPO es la acción y el TIPO es una etiqueta dentro de
 * la ficha.
 *
 * LA REGLA QUE MANDA TODO
 *
 * Un campo que el equipo no siguió se muestra como "—", con el motivo. Nunca
 * se completa con algo inventado. Un link a una pantalla que no existe abre la
 * portada sin dar error, y el que pierde una hora probando es Pablo.
 */
(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function n(x) { return Number(x) || 0; }

    // ── parser de FEATURES.md ────────────────────────────────────────────
    // Formato controlado por las reglas del AGENTS.md del Principal:
    //   ## Nombre de fantasía
    //   - **Campo:** valor
    // Todo lo que no matchea ese patrón se ignora, así que el archivo puede
    // llevar texto explicativo arriba sin romper el parseo.

    var CAMPOS = ['tipo', 'estado', 'dónde la veo', 'ruta', 'descripción',
                  'commits', 'rama', 'si no entra', 'si sale mal'];

    function norm(s) {
        return String(s == null ? '' : s)
            .toLowerCase()
            .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
            .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
            .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
            .replace(/[^a-z0-9/]/g, '');
    }

    /**
     * @param {string} md  texto crudo de FEATURES.md
     * @returns {Array} fichas
     */
    function parseFeatures(md) {
        if (!md || typeof md !== 'string') return [];
        var out = [];
        // corta en la sección de ejemplo: las reglas del encabezado no son fichas
        var cut = md.indexOf('## Fichas');
        var cuerpo = cut >= 0 ? md.slice(cut + '## Fichas'.length) : md;

        var re = /^##[ \t]+(.+?)[ \t]*$/gm;
        var heads = [];
        var m;
        while ((m = re.exec(cuerpo)) !== null) {
            heads.push({ titulo: m[1].trim(), ini: m.index, fin: m.index + m[0].length });
        }

        for (var i = 0; i < heads.length; i++) {
            var h = heads[i];
            var fin = (i + 1 < heads.length) ? heads[i + 1].ini : cuerpo.length;
            var bloque = cuerpo.slice(h.fin, fin);
            var f = { nombre: h.titulo, campos: {} };

            // Markdown natural: "- **Tipo:** nueva" -> los ':' van DENTRO de los
            // asteriscos. Se acepta también la forma "**Tipo**: nueva".
            var rCampo = /^[ \t]*[-*][ \t]*\*\*(.+?)\*\*:?[ \t]*(.*)$/;
            var actual = null;          // clave del campo que se sigue completando
            var lineas = cuerpo.slice(h.fin, fin).split(/\r?\n/);

            for (var L = 0; L < lineas.length; L++) {
                var linea = lineas[L];
                var mm = rCampo.exec(linea);
                if (mm) {
                    // norm() se come los ':' colgantes del nombre del campo
                    actual = norm(mm[1]);
                    f.campos[actual] = mm[2].replace(/\s*$/, '').trim() || '—';
                    continue;
                }
                // Continuación: en español TODO se envuelve. Si la línea no es
                // campo, ni encabezado, ni lista, ni tabla, ni código, y ya
                // había un campo abierto, es su continuación.
                var t = linea.trim();
                if (!t || actual === null) continue;
                if (/^[#>|*`]/.test(t)) { actual = null; continue; }
                if (/^[-–—]/.test(t))    { actual = null; continue; }
                if (f.campos[actual] === '—') f.campos[actual] = t;
                else f.campos[actual] += ' ' + t;
            }
            f.tipo = normTipo(f.campos.tipo);
            f.estado = normEstado(f.campos.estado);
            out.push(f);
        }
        return out;
    }

    function normTipo(v) {
        var t = norm(v);
        if (t.indexOf('nueva') >= 0) return 'nueva';
        if (t.indexOf('visible') >= 0) return 'mejora visible';
        if (t.indexOf('oculta') >= 0 || t.indexOf('invisible') >= 0) return 'mejora oculta';
        return v || '—';
    }

    function normEstado(v) {
        var e = norm(v);
        if (!e || e === '' || e === '-') return 'listo';   // por defecto: espera prueba
        if (e.indexOf('autorizado') >= 0) return 'autorizado';
        if (e.indexOf('rechazado') >= 0) return 'rechazado';
        if (e.indexOf('revertido') >= 0) return 'revertido';
        if (e.indexOf('nobva') >= 0 || e.indexOf('no') === 0) return 'probado no va';
        if (e.indexOf('ok') >= 0 || e.indexOf('probado') >= 0) return 'probado ok';
        if (e.indexOf('listo') >= 0) return 'listo';
        return String(v);
    }

    // ── agrupación por acción ────────────────────────────────────────────
    function agrupar(fichas) {
        var g = { decidir: [], produccion: [], descartado: [] };
        fichas.forEach(function (f) {
            var e = f.estado;
            if (e === 'autorizado') g.produccion.push(f);
            else if (e === 'rechazado' || e === 'revertido' || e === 'probado no va') g.descartado.push(f);
            else g.decidir.push(f);
        });
        return g;
    }

    // ── links verificados ────────────────────────────────────────────────
    // La ficha declara una Ruta. Solo se linkea si esa ruta existe en el
    // catálogo medido sobre el js/ real de dev. Si no existe, NO se inventa
    // un link: se muestra el texto y se dice por qué no hay link.
    function construirLinks(fichas, catalogo) {
        var porRuta = {};
        (catalogo && catalogo.pantallas || []).forEach(function (p) {
            porRuta[norm(p.ruta)] = p;
        });
        fichas.forEach(function (f) {
            var r = norm(f.campos.ruta);
            var p = r && porRuta[r];
            f.linkVerificado = p ? (p.url) : null;
            f.nombrePantalla = p ? (p.nombre || p.ruta) : null;
            if (p && !p.en_menu) f.subvista = true;
        });
        return fichas;
    }

    // ── render ───────────────────────────────────────────────────────────
    var CHIP = {
        'nueva': 'NUEVA',
        'mejora visible': 'MEJORA VISIBLE',
        'mejora oculta': 'MEJORA OCULTA'
    };

    function fichaHTML(f) {
        var c = f.campos;
        var falta = function (v) { return !v || v === '—'; };

        var meta = [];
        if (c.commits && c.commits !== '—') {
            var shas = String(c.commits).match(/[0-9a-f]{7,40}/g) || [];
            meta.push('<span class="feat-meta__commits">' + n(shas.length) +
                (shas.length === 1 ? ' commit' : ' commits') + '</span>');
        }
        if (c.rama && c.rama !== '—') {
            meta.push('<code class="feat-meta__rama">' + esc(c.rama) + '</code>');
        }

        var donde = '';
        if (c['dondelaveo'] && c['dondelaveo'] !== '—') {
            donde = '<p class="feat-donde"><span class="feat-donde__lbl">Dónde</span> ' +
                    esc(c['dondelaveo']) + '</p>';
        }

        var boton = f.linkVerificado
            ? '<a class="feat-btn" href="' + esc(f.linkVerificado) + '" target="_blank" ' +
              'rel="noopener">Probar en dev →</a>'
            : (falta(c.ruta)
                ? '<span class="feat-btn feat-btn--sin" title="No tiene pantalla propia">Sin pantalla</span>'
                : '<span class="feat-btn feat-btn--sin" title="La ruta declarada no existe en el catálogo medido de dev">Ruta no verificada</span>');

        var riesgo = '';
        if (c.sisalemal && c.sisalemal !== '—') {
            riesgo = '<p class="feat-riesgo"><span class="feat-riesgo__lbl">Si sale mal</span> ' +
                     esc(c.sisalemal) + '</p>';
        }
        var sinEntrar = '';
        if (c.sinoentra && c.sinoentra !== '—') {
            sinEntrar = '<p class="feat-riesgo feat-riesgo--b"><span class="feat-riesgo__lbl">Si no entra</span> ' +
                        esc(c.sinoentra) + '</p>';
        }

        var faltan = [];
        ['descripcion', 'dondelaveo', 'commits'].forEach(function (k) {
            if (falta(c[k])) faltan.push(k);
        });
        var aviso = faltan.length
            ? '<p class="feat-falta">faltan: ' + faltan.join(', ') + '</p>'
            : '';

        return '' +
        '<article class="feat">' +
            '<header class="feat__head">' +
                '<span class="feat-chip feat-chip--' + esc(normTipo(f.tipo).replace(/\s/g, '-')) + '">' +
                    esc(CHIP[f.tipo] || f.tipo || 'SIN TIPO') + '</span>' +
                '<h4 class="feat__nombre">' + esc(f.nombre) + '</h4>' +
            '</header>' +
            (c.descripcion && c.descripcion !== '—'
                ? '<p class="feat__desc">' + esc(c.descripcion) + '</p>'
                : '<p class="feat__desc feat__desc--falta">Sin descripción. El equipo no la escribió.</p>') +
            donde +
            '<p class="feat__meta">' + meta.join('') + '</p>' +
            '<p class="feat__acc">' + boton + aviso + '</p>' +
            riesgo + sinEntrar +
        '</article>';
    }

    function grupoHTML(titulo, fichas, abierto, nota) {
        if (!fichas.length) return '';
        return '' +
        '<details class="feat-grupo" ' + (abierto ? 'open' : '') + '>' +
            '<summary class="feat-grupo__sum">' +
                '<span class="feat-grupo__t">' + esc(titulo) + '</span>' +
                '<span class="feat-grupo__n">' + n(fichas.length) + '</span>' +
            '</summary>' +
            (nota ? '<p class="feat-grupo__nota">' + esc(nota) + '</p>' : '') +
            '<div class="feat-grupo__body">' +
                fichas.map(fichaHTML).join('') +
            '</div>' +
        '</details>';
    }

    /**
     * @param {Array} fichas  parseFeatures(FEATURES.md)
     * @param {Object|null} catalogo  data/dev-catalogo.json (para validar rutas)
     * @param {string|null} error
     */
    function build(fichas, catalogo, error) {
        var enc = '<div class="feat-enc">';

        if (error) {
            return enc +
                '<p class="feat-err">No se pudo leer <code>FEATURES.md</code> (' +
                esc(error) + '). El equipo puede no haberlo escrito todavía; ' +
                'eso NO significa que no haya trabajo hecho.</p>' +
            '</div>';
        }
        if (!fichas || !fichas.length) {
            return enc +
                '<p class="feat-err">FEATURES.md no tiene fichas todavía. ' +
                'El equipo tiene que escribirlas al mergear a <code>agents/main</code> ' +
                '(regla en el AGENTS.md del Principal). Mientras esté vacío, esta ' +
                'tab no puede decirte qué hay para probar.</p>' +
            '</div>';
        }

        construirLinks(fichas, catalogo);
        var g = agrupar(fichas);

        var cuerpo = grupoHTML('Tenés que decidir', g.decidir, true,
            'Cada una está en dev y se puede probar. Tocá "Probar en dev" y decidí.') +
            grupoHTML('Ya está en producción', g.produccion, false, null) +
            grupoHTML('Descartado', g.descartado, false, null);

        var sinLink = fichas.filter(function (f) { return !f.linkVerificado; }).length;

        return enc +
            '<h3 class="feat-enc__titulo">Qué construyó el equipo y dónde se ve</h3>' +
            '<p class="feat-enc__sub">Todo lo que el equipo escribió y mergeó a ' +
                '<code>agents/main</code>. Los links abren la app de desarrollo, ' +
                'no producción.</p>' +
            '<div class="feat-enc__kpis">' +
                '<div class="feat-kpi"><span class="feat-kpi__n">' + n(g.decidir.length) + '</span>' +
                    '<span class="feat-kpi__l">para decidir</span></div>' +
                '<div class="feat-kpi"><span class="feat-kpi__n">' + n(g.produccion.length) + '</span>' +
                    '<span class="feat-kpi__l">en producción</span></div>' +
                '<div class="feat-kpi' + (sinLink ? ' feat-kpi--alerta' : '') + '">' +
                    '<span class="feat-kpi__n">' + n(sinLink) + '</span>' +
                    '<span class="feat-kpi__l">sin link verificable</span></div>' +
            '</div>' +
            cuerpo +
        '</div>';
    }

    window.DevCatalogo = {
        build: build,
        parseFeatures: parseFeatures,
        agrupar: agrupar,
        construirLinks: construirLinks,
        esc: esc
    };
})();
