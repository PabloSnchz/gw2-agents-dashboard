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

    // Limpieza del VALOR CRUDO, antes de norm().
      //
      // Por qué existe: el que escribe es un LLM, y escribe `` `—` `` con
      // backticks y seguido de un paréntesis explicativo. Con el valor tal
      // cual, "`—`" no es igual a "—", así que un campo que el equipo dejó
      // vacío seOe leer como "declaró algo que no existe".
      //
      // No se puede resolver del lado de la escritura: no puedo pedirle a un
      // agente que sea breve y que lo sea para siempre. El que LEE tiene que
      // ser tolerante. Un parser estricto obliga a un escritor perfecto; uno
      // tolerante solo obliga a que el escritor no mienta, que es lo único
      // que importa de verdad.
      function limpiar(v) {
        return String(v == null ? '' : v)
          .replace(/`/g, '')
          .trim();
      }

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

        var re = /^##[ \t]+(.+?)[ \t]*$/gm;
        var heads = [];
        var m;
        while ((m = re.exec(md)) !== null) {
            heads.push({ titulo: m[1].trim(), ini: m.index, fin: m.index + m[0].length });
        }

        for (var i = 0; i < heads.length; i++) {
            var h = heads[i];
            var fin = (i + 1 < heads.length) ? heads[i + 1].ini : md.length;
            var bloque = md.slice(h.fin, fin);
            var f = { nombre: h.titulo, campos: {} };

            // Markdown natural: "- **Tipo:** nueva" -> los ':' van DENTRO de los
            // asteriscos. Se acepta también la forma "**Tipo**: nueva".
            var rCampo = /^[ \t]*[-*][ \t]*\*\*(.+?)\*\*:?[ \t]*(.*)$/;
            var actual = null;          // clave del campo que se sigue completando
            var lineas = bloque.split(/\r?\n/);

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

            // ── qué ES una ficha ─────────────────────────────────────────
            //
            // ANTES: el parseo cortaba el documento en el encabezado '## Fichas'
            // y descartaba TODO lo que estaba arriba de ese índice.
            //
            // Eso no era "sacarle las reglas del encabezado", que es lo que
            // decía el comentario: se llevaba dos fichas REALES. El equipo
            // pegó 'la cola de crafteo' y 'materiales de una legendaria' antes
            // del índice, y el panel las perdió. Medido el 2026-10-04: 12
            // fichas de 14. Dos features de la Armería existían y no se veían.
            //
            // AHORA: una ficha es una sección que DECLARA Tipo. Las secciones de
            // documentación ('Qué significa cada estado', 'Fichas', ...) no lo
            // declaran y se caen solas — sin una lista de títulos que mantener,
            // que es lo que vuelve brittle a un filtro por nombre. La plantilla
            // se cae por su propio valor: trae la lista de estados posibles
            // separada por '|', y ninguna ficha real puede declararla.
            //
            // Lo que NO se arregla acá: 'Cómo leer el archivo de ideas' tiene
            // 'Tipo: mejora oculta' y es documentación. No la esconde, porque
            // el error es del que la escribió como si fuera ficha, y taparlo
            // con un filtro por título sería un filtro que no distingue lo que
            // quiere medir. Se muestra y se dice.
            if (!f.campos.tipo) continue;
            if (String(f.campos.tipo).indexOf('|') >= 0) continue;

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

    // ── cruce con el registro de promociones ───────────────────────────
    //
    // POR QUE PROMOTIONS.md Y NO EL CAMPO `Estado:` DE FEATURES.md
    //
    // `Estado:` se escribe al CREAR la feature, y nadie lo actualiza al
    // promover. Medido el 2026-10-04: las 5 fichas de la Armería seguían
    // diciendo 'listo' con los 12 módulos ya en producción — 67 de 67
    // archivos de js/, css/ e index.html idénticos byte a byte — y el panel
    // mostraba 0 en producción.
    //
    // PROMOTIONS.md se escribe en el MOMENTO de promover, que es cuando la
    // decisión existe. Es el registro de la decisión, no una etiqueta de
    // intenciones. Sigue siendo una declaración —no la midió nadie— pero es
    // la declaración del acto, y esa se mantiene.

    function aplicarPromocion(fichas, promo) {
        var g = { porNombre: {}, rutas: {} };

        var bolsa = []
            .concat((promo && promo.decidido) || [])
            .concat((promo && promo.prodSinVerificar) || []);

        bolsa.forEach(function (d) {
            var det = String(d.detalle || '');
            // REVERTIDO no está en producción, aunque esté en `decidido`.
            if (/revertid/i.test(det)) return;
            var nom = norm(limpiar(d.nombre));
            if (!nom) return;
            g.porNombre[nom] = d;
            // La ficha se llama 'Armería Legendaria' y el registro
            // 'Armería Legendaria — 12 módulos nuevos, 36 archivos'. Se guardan
            // además las palabras iniciales para el prefijo.
            g.porNombre[nom.split(' ').slice(0, 4).join(' ')] = d;
        });

        fichas.forEach(function (f) {
            f.estadoProd = null;
            var nom = norm(f.nombre);
            var d = g.porNombre[nom] ||
                g.porNombre[nom.split(' ').slice(0, 4).join(' ')] ||
                Object.keys(g.porNombre).filter(function (k) {
                    return k.length > 6 && (nom.indexOf(k) === 0 || k.indexOf(nom) === 0);
                }).map(function (k) { return g.porNombre[k]; })[0];

            if (d) {
                f.estadoProd = { via: 'registro', ref: d, nombre: limpiar(d.nombre) };
                var r = norm(limpiar(f.campos.ruta).split(/\s+/)[0]);
                if (r) g.rutas[r] = true;
                return;
            }

            // Segunda pasada: heredar por ruta SOLO si esa ruta coincide con la
            // de una ficha que el REGISTRO dice que se promovió.
            //
            // El límite está escrito porque la alternativa —heredar por
            // cualquier ruta— sobrevende: 'Importar un backup' apunta a
            // /account/accounts, que existe en producción desde hace semanas, y
            // ese fix NO está. Compartir pantalla no prueba nada; lo que
            // prueba es que una promoción concreta se llevó esa pantalla
            // entera, y por eso las sub-fichas de esa promoción sí cuentan.
            f._ruta = norm(limpiar(f.campos.ruta).split(/\s+/)[0]);
        });

        fichas.forEach(function (f) {
            if (f.estadoProd || !f._ruta || !g.rutas[f._ruta]) return;
            f.estadoProd = { via: 'misma promoción', ref: null, nombre: null };
        });

        return fichas;
    }

    function agrupar(fichas) {
        var g = { decidir: [], produccion: [], descartado: [] };
        fichas.forEach(function (f) {
            // El REGISTRO de promociones manda sobre el campo `Estado:`.
            // Razon medida el 2026-10-04: `Estado:` se escribe al crear la
            // feature y nadie lo actualiza al promover, asi que las 5 fichas
            // de la Armeria decian 'listo' con los 12 modulos ya promovidos.
            // PROMOTIONS.md si se mantiene, porque se escribe al promover.
            if (f.estadoProd) { g.produccion.push(f); return; }
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
            // Las fichas se escriben a mano y el paréntesis explicativo se cuela
            // en el campo Ruta. Una ruta no tiene espacios: se toma el primer
        // token y el resto es explicación, no parte de la dirección.
        var rnorm = norm(limpiar(f.campos.ruta).split(/\s+/)[0]);
        var r = rnorm && rnorm.indexOf('/') === 0 ? rnorm : '';
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
        // Un guion abreindo el campo significa AUSENTE, no "terminó en guion".
        // `—` y `` `—` (no tiene pantalla) `` son los dos la misma cosa: nadie
        // declaró una ruta. Antes el segundo caia en "ruta no verificada", que
        // además acusa a alguien de haber inventado una.
        var falta = function (v) {
          var s = limpiar(v);
          return !s || /^[—–-]/.test(s);
        };

        var meta = [];
        if (c.commits && c.commits !== '—') {
            var shas = String(c.commits).match(/[0-9a-f]{7,40}/g) || [];
            meta.push('<span class="feat-meta__commits">' + n(shas.length) +
                (shas.length === 1 ? ' commit' : ' commits') + '</span>');
        }
        if (c.rama && c.rama !== '—') {
            meta.push('<code class="feat-meta__rama">' + esc(c.rama) + '</code>');
        }
        if (f.estadoProd) {
            var ref = f.estadoProd.ref;
            var como = f.estadoProd.via === 'registro'
                ? 'registro: ' + esc(String(f.estadoProd.nombre).slice(0, 46)) +
                  (ref && ref.commit ? ' @ ' + esc(String(ref.commit).slice(0, 7)) : '')
                : 'misma promoción que su pantalla';
            meta.push('<span class="feat-meta__prod">en producción · ' + como + '</span>');
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

        aplicarPromocion(fichas, window.__promoParsed || null);
        construirLinks(fichas, catalogo);
        var g = agrupar(fichas);

        // ── qué se puede CONTAR y qué no ────────────────────────────────
        //
        // 'en producción' sale del campo `Estado:` de FEATURES.md. Es una
        // DECLARACIÓN del equipo, no una medición: el panel no abre git.
        //
        // El 2026-10-04 ese KPI decía 0 con la Armería Legendaria entera ya
        // promovida. Medido por separado: 67 de 67 archivos de js/, css/ e
        // index.html idénticos byte a byte entre gw2-dev y gw2-wallet-ligero,
        // ruta '#/account/legendary-armory' montada en producción con sus 7
        // scripts, y PROMOTIONS.md:77 con la promoción registrada como
        // AUTORIZADO. El 0 no era una medición: era un campo que nadie
        // actualizó al promover.
        //
        // Un KPI que afirma un número que no puede verificar es peor que uno
        // que no existe, porque se ve igual de preciso. Por eso cada tarjeta
        // dice DE DÓNDE sale su número, y el bloque medido de abajo dice el
        // verdadero, con su fuente.
        //
        // Lo que falta para que esto sea verdad SOLO: que la ficha declare qué
        // archivo la implementa. Con ese campo el panel compara sha contra
        // producción sin preguntarle a nadie. Se descartó cruzar por ruta
        // porque sobrevende: 'Importar un backup' apunta a
        // /account/accounts, que existe en producción desde hace semanas, y
        // ese fix no está. Una ruta compartida no dice si la feature está.

        // 'sin link verificable' mezclaba dos cosas distintas: fichas que NO
        // TIENEN pantalla (mejoras ocultas — es correcto que no la tengan, no
        // es un error) y fichas que declaran una ruta que no existe (eso sí es
        // una alerta). Medido el 2026-10-04: 6 de las 7 eran lo primero, y el
        // KPI las contaba como problema.
        var sinPantalla = 0, rutaRota = 0;
        fichas.forEach(function (f) {
            if (f.linkVerificado) return;
            var v = limpiar(f.campos.ruta);
            if (!v || /^[—–-]/.test(v)) sinPantalla++; else rutaRota++;
        });

        function kpi(n_, l, src, alerta) {
            return '<div class="feat-kpi' + (alerta ? ' feat-kpi--alerta' : '') + '">' +
                '<span class="feat-kpi__n">' + n(n_) + '</span>' +
                '<span class="feat-kpi__l">' + esc(l) + '</span>' +
                '<span class="feat-kpi__src">' + esc(src) + '</span></div>';
        }

        var cuerpo = grupoHTML('Tenés que decidir', g.decidir, true,
            'Cada una está en dev y se puede probar. Tocá "Probar en dev" y decidí. ' +
            '<strong>El estado lo declara el equipo</strong> en FEATURES.md; ' +
            'el panel no lo contrasta contra producción.') +
            grupoHTML('Ya está en producción', g.produccion, false,
                'Declarado como autorizado por el equipo. Abajo se mide de verdad ' +
                'qué hay en producción.') +
            grupoHTML('Descartado', g.descartado, false, null);

        return enc +
            '<h3 class="feat-enc__titulo">Qué construyó el equipo y dónde se ve</h3>' +
            '<p class="feat-enc__sub">Todo lo que el equipo escribió y mergeó a ' +
                '<code>agents/main</code>. Los links abren la app de desarrollo, ' +
                'no producción.</p>' +
            '<div class="feat-enc__kpis">' +
                kpi(g.decidir.length, 'para decidir', 'declarado') +
                kpi(g.produccion.length, 'en producción', 'registro de promociones') +
                kpi(sinPantalla, 'sin pantalla propia', 'correcto si es oculta') +
                kpi(rutaRota, 'ruta no verificada', 'alerta', rutaRota > 0) +
            '</div>' +
            medidoHTML(window.__prodMedido) +
            cuerpo +
        '</div>';
    }

    /**
     * Lo que el panel SÍ puede afirmar, porque lo midió: qué archivos del
     * clon de desarrollo están en producción con el mismo contenido.
     *
     * No cruza con las fichas: no hay dato que cruce. Muestra la verdad del
     * árbol, que es lo que hay, y lo dice.
     */
    function medidoHTML(m) {
        if (!m) {
            return '<p class="feat-medido feat-medido--no">No se pudo medir qué hay ' +
                'en producción: el medidor no corrió o no pudo leer los dos clones. ' +
                'Los números de arriba <strong>no</strong> vienen de ahí.</p>';
        }
        var a = m.archivos || {};
        var hayFaltantes = (a.solo_dev_webapp || 0) > 0 || (a.distintos || 0) > 0;

        var veredicto;
        if (!hayFaltantes) {
            veredicto = 'Todo el código web de desarrollo está en producción, ' +
                'byte a byte. Nada esperando promoción.';
        } else {
            veredicto = 'Hay código en desarrollo que todavía no llegó a producción.';
        }

        var out = '<div class="feat-medido' + (hayFaltantes ? '' : ' feat-medido--ok') + '">' +
            '<p class="feat-medido__t">Lo que está en producción, medido</p>' +
            '<p class="feat-medido__v">' + esc(veredicto) + '</p>' +
            '<ul class="feat-medido__l">' +
                '<li>' + n(a.identicos) + ' de ' + n(a.comparados) +
                    ' archivos idénticos entre dev y producción</li>' +
                '<li>' + n(a.distintos) + ' con contenido distinto</li>' +
                '<li>' + n(a.solo_dev_webapp) + ' módulos web solo en desarrollo' +
                    (a.solo_dev_no_webapp ? ' (+' + n(a.solo_dev_no_webapp) +
                        ' herramientas, tests y documentación, que no van a producción)' : '') +
                '</li>' +
            '</ul>';

        if (m.solo_dev_webapp_lista && m.solo_dev_webapp_lista.length) {
            out += '<p class="feat-medido__detalle">Solo en desarrollo:<br>' +
                m.solo_dev_webapp_lista.map(function (f) {
                    return '<code>' + esc(f) + '</code>';
                }).join('<br>') + '</p>';
        }
        out += '<p class="feat-medido__src">Medido por <code>gen_promocion.py</code> ' +
            'el ' + esc(m.generado_utc || '?') + ' · dev <code>' + esc(m.dev_head || '?') +
            '</code> · producción <code>' + esc(m.prod_head || '?') + '</code></p>';
        return out + '</div>';
    }

    window.DevCatalogo = {
        build: build,
        parseFeatures: parseFeatures,
        agrupar: agrupar,
        construirLinks: construirLinks,
        esc: esc
    };
})();
