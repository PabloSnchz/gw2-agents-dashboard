/**
 * _test_prod_sin_verificar.js — el estado "en producción sin verificar"
 *
 * Este es el estado que NO existía y que este cambio agrega. Se prueba
 * contra la fila REAL de PROMOTIONS.md, no contra una invented, porque
 * el caso interesante es justamente el texto que wrote el equipo.
 *
 * Lo que este test protege: que la fila siga siendo legible como lo que
 * es. Antes de este cambio se leía como "congelado" (que es verdad) o
 * como "esperando tu decisión" (que es mentira). Las dossalen mal.
 *
 *   - como congelado   → Pablo no se entera de que falta probarlo
 *   - como pendiente   → se le pide decidir algo ya resuelto
 *   - como autorizado  → se afirma que funciona; nadie lo comprobó
 */
const fs = require('fs');
const path = require('path');

// renderer.js toca window y document AL EVALUAR (window.toggleAccordion =),
// así que los stubs van antes, como en _test_render_promo.js.
global.window = { DASHBOARD_CONFIG: { repoOwner: 'PabloSnchz', repoName: 'gw2-wallet-agents' } };
global.document = { getElementById: () => null };
global.marked = { parse: () => '<p>md</p>' };

// La asignación se concatena al eval para sacarlas del scope del archivo.
(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'parser.js'), 'utf8') +
           '\n;globalThis.__P = DashboardParser;');
(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'renderer.js'), 'utf8') +
           '\n;globalThis.__R = DashboardRenderer;');

const P = globalThis.__P;
const R = globalThis.__R;

let pass = 0, fail = 0;
const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }

const MD = fs.readFileSync('C:/Mis Archivos/GW2 online/gw2-dev/PROMOTIONS.md', 'utf8');
const promo = P.parsePromotions(MD);

// ─────────────────────────────────────────────────────────────
// A. La fila real
// ─────────────────────────────────────────────────────────────
const sv = promo.prodSinVerificar || [];
ok(sv.length === 1, `A1 debería haber 1 item sin verificar, hay ${sv.length}`);

const it = sv[0];
ok(it && /392c3b9/.test(it.raw), 'A2 es el 392c3b9');
ok(it && /Solitary Throne/.test(it.nombre), 'A3 conserva el nombre del feature');
ok(it && it.state === 'prod_sin_verificar', `A4 state, salió "${it && it.state}"`);

// ─────────────────────────────────────────────────────────────
// B. Lo que NO puede pasar
// ─────────────────────────────────────────────────────────────
ok(!promo.esperando.some(i => /392c3b9/.test(i.raw)),
   'B1 NO puede pedirle a Pablo que decida algo ya resuelto');
ok(!promo.congelado.some(i => /392c3b9/.test(i.raw)),
   'B2 no cae en congelado: ahí quedaría escondido que falta probarlo');
ok(!promo.decidido.some(i => /392c3b9/.test(i.raw)),
   'B3 no cae en "ya decidido": eso afirmaría que funciona');
ok(!promo.noCandidato.some(i => /392c3b9/.test(i.raw)),
   'B4 no es candidato a promoción: ya está en producción');
ok(!promo.indeterminado.some(i => /392c3b9/.test(i.raw)),
   'B5 no es un fallo de lectura: se leyó bien');

// ─────────────────────────────────────────────────────────────
// C. Los otros items NO se movieron
// ─────────────────────────────────────────────────────────────
ok(promo.esperando.some(i => /Idea 50/.test(i.raw)),
   'C1 el botón de caché sigue esperando decisión');
ok(promo.decidido.some(i => /57008ae/.test(i.raw)),
   'C2 el 57008ae sigue en decisiones tomadas');
ok(promo.decidido.some(i => /07e4c64/.test(i.raw)),
   'C3 el 07e4c64 revertido sigue en el historial');
ok(promo.noCandidato.length > 0, 'C4 los no candidatos siguen siendo no candidatos');

// ─────────────────────────────────────────────────────────────
// D. El render
// ─────────────────────────────────────────────────────────────
// renderPromotions NO devuelve: escribe en el DOM. Hay que darle el
// elemento que busca y leer innerHTML después. Probar que "no tira
// excepción" sería otra cosa, y no probaría nada.
function render(p, md) {
    const c = { innerHTML: '' };
    global.document = { getElementById: id => (id === 'promotions-container' ? c : null) };
    R.renderPromotions(p, md, null, null, null, null, null, null);
    return c.innerHTML || '';
}

const html = render(promo, MD);
ok(html.indexOf('En producción, sin verificar') > 0, 'D1 el bloque aparece');
ok(html.indexOf('sin verificar') > 0, 'D2 el badge dice sin verificar');
ok(html.indexOf('nadie confirmó que funcione') > 0, 'D3 dice lo que falta, no solo el estado');
ok(html.toLowerCase().indexOf('no espera tu decisión') > 0, 'D4 aclara que no espera decisión');

// lo primero que se lee tiene que ser el aviso, no el item viejo
const iAviso = html.indexOf('En producción, sin verificar');
const i392 = html.indexOf('Solitary Throne');
ok(iAviso > 0 && i392 > 0, 'D5 están los dos en el HTML');
ok(iAviso < i392, 'D6 el bloque va antes que la tarjeta: el aviso primero');

// ─────────────────────────────────────────────────────────────
// E. Variantes de texto — el regex no puede ser frágil
// ─────────────────────────────────────────────────────────────
// Dos helpers, porque la SECCIÓN cambia lo que pasa. Este mete la fila en
// "Decisiones tomadas"; con un AUTORIZADO eso lo manda a `decidido`, no a
// `congelado` — porque si la decisión ya está tomada, congelado sería
// mentir diciendo que falta algo por decidir.
function clasifica(fila) {
    const md = [
        '## Decisiones tomadas por Pablo', '',
        '| Fecha | Decisión |',
        '|---|---|',
        '| 2026-10-01 | ' + fila + ' |',
    ].join('\n');
    const p = P.parsePromotions(md);
    return {
        sv: (p.prodSinVerificar || []).length,
        cong: (p.congelado || []).length,
        esp: p.esperando.length,
        dec: p.decidido.length,
    };
}

// Este mete la fila en "Pendientes de decisión", donde un LISTO sí espera.
function clasificaPendiente(fila) {
    const md = [
        '## Pendientes de decisión', '',
        '| Feat | Commits | Estado |',
        '|---|---|---|',
        '| (X) | `abc1234` | ' + fila + ' |',
    ].join('\n');
    const p = P.parsePromotions(md);
    return {
        sv: (p.prodSinVerificar || []).length,
        esp: p.esperando.length,
    };
}

ok(clasifica('`abc1234` (X): **EN PRODUCCIÓN, SIN VERIFICAR**. No revertir.').sv === 1,
   'E1 la forma canónica');
ok(clasifica('`abc1234` (X): está en producción, sin verificar.').sv === 1,
   'E2 minúsculas, sin la coma');
ok(clasifica('`abc1234` (X): **EN PRODUCCIÓN**. Nadie lo verificó todavía.').sv === 1,
   'E3 el "sin verificar" separado de "en producción"');
ok(clasifica('`abc1234` (X): **AUTORIZADO** en producción. No tocar.').sv === 0,
   'E4 un autorizado de verdad NO cae acá');
ok(clasifica('`abc1234` (X): **AUTORIZADO** en producción. No tocar.').dec === 1,
   'E5 un AUTORIZADO con "no tocar" va a decididos, no a congelado: congelado diría que falta decidir');
ok(clasifica('`abc1234` (X): **PENDIENTE**. No revertir.').sv === 0,
   'E6 un pendiente normal NO es "sin verificar"');
ok(clasifica('`abc1234` (X): **PENDIENTE**. No revertir.').cong === 1,
   'E7 y sigue congelado');
ok(clasificaPendiente('**LISTO.**').esp === 1,
   'E8 un LISTO en pendientes sigue esperando decisión');
ok(clasificaPendiente('**AUTORIZADO**, verificado por Pablo.').sv === 0,
   'E9 un "verificado" NO es "sin verificar": es lo contrario');

// ─────────────────────────────────────────────────────────────
console.log(`\n${pass} ok, ${fail} fallos\n`);
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('Lo que ya está en producción y nadie probó, se ve como eso.');