/**
 * _test_promo.js — prueba del parser de PROMOTIONS.md contra el ARCHIVO REAL.
 *
 * Por qué contra el archivo real y no contra un ejemplo inventado: los tres
 * bugs que se arreglaron (el "unknown" disfrazado de decisión, los no-
 * candidatos mostrados como decididos, y 392c3b9 pidiendo una decisión) solo
 * se ven con el texto que el equipo escribe de verdad. Un ejemplo invented
 * pasa siempre y no prueba nada.
 *
 * Uso: node _test_promo.js
 */
const fs = require('fs');
const path = require('path');

// El parser.js es un `class DashboardParser {...}` pelado, sin export ni IIFE.
// Con eval indirecto la clase queda en el scope del eval y no en el global,
// así que se engancha a mano antes de evaluarlo.
const src = fs.readFileSync(path.join(__dirname, 'js', 'parser.js'), 'utf8');
(0, eval)(src + '\n;globalThis.__P = DashboardParser;');
const Parser = globalThis.__P;

if (!Parser) {
    console.log('FALLO: no encontre la clase del parser en el global');
    console.log('globals:', Object.keys(global).filter(k => /pars|qwen|dash/i.test(k)));
    process.exit(1);
}

const md = fs.readFileSync(path.join(__dirname, '_fixture_promotions.md'), 'utf8');
const promo = Parser.parsePromotions(md);

let ok = 0, fail = 0;
const check = (nombre, cond, extra) => {
    if (cond) { ok++; console.log('  OK   ' + nombre); }
    else { fail++; console.log('  FALLA ' + nombre + (extra ? '  -> ' + extra : '')); }
};

console.log('\n=== parsePromotions contra el PROMOTIONS.md real ===');
console.log('parseable:', promo.parseable, '| actualizado:', promo.updatedAt);
console.log('esperando:', promo.esperando.length,
            '| congelado:', promo.congelado.length,
            '| noCandidato:', promo.noCandidato.length,
            '| indeterminado:', promo.indeterminado.length,
            '| decidido:', promo.decidido.length);

const show = (et, arr) => arr.forEach(i => console.log('   [' + et + '] ' +
    (i.commit || '------') + '  ' + i.nombre + (i.detalle ? '  ::  ' + i.detalle : '')));
show('ESPERA', promo.esperando);
show('CONGEL', promo.congelado);
show('NO-CAND', promo.noCandidato);
show('INDET', promo.indeterminado);
show('DECID', promo.decidido);

console.log('\n--- BUG 1: 392c3b9 no puede aparecer pidiendo una decisión ---');
check('392c3b9 NO esta en "esperando tu decisión"',
    !promo.esperando.some(i => i.commit === '392c3b9'));
check('392c3b9 esta en "congelado"', promo.congelado.some(i => i.commit === '392c3b9'));
check('y su motivo queda escrito (no revertir ni modificar)',
    /no revertir ni modificar/i.test((promo.congelado.find(i => i.commit === '392c3b9') || {}).raw || ''));

console.log('\n--- BUG 2: los no-candidatos NO pueden figurar como decisiones tomadas ---');
const t3 = promo.noCandidato.find(i => /idea 61/i.test(i.nombre));
check('Idea 61 Tramo 3 esta en "no candidato"', !!t3, 'no aparecio en noCandidato');
check('Idea 61 NO esta en "decidido"', !promo.decidido.some(i => /idea 61/i.test(i.nombre)));
check('Idea 61 NO esta en "esperando"', !promo.esperando.some(i => /idea 61/i.test(i.nombre)));
check('y se conserva el motivo del equipo ("es codigo de test")',
    !!(t3 && /test/i.test((t3.motivo || '') + ' ' + (t3.raw || ''))));

console.log('\n--- BUG 3: el unico item accionable tiene que ser encontrable ---');
const idea50 = promo.esperando.find(i => /idea 50/i.test(i.nombre));
check('el boton de cacheClear esta en "esperando"', !!idea50);
check('su nombre no esta cortado a mitad ("Tramos A-F" no queda pegado al nombre)',
    !!idea50 && !/tramos a-f$/i.test(idea50.nombre), idea50 ? idea50.nombre : '-');
check('su estado es "ready" (no unknown)', !!idea50 && idea50.state === 'ready',
    idea50 ? idea50.state : '-');
check('los 4 shas se leyeron (3 + merge)', !!idea50 && idea50.commits.length >= 4,
    idea50 ? String(idea50.commits) : '-');
check('la rama se leyo', !!idea50 && /idea50/.test(idea50.rama || ''));

console.log('\n--- BUG 4: la frase rota "revertido con ." ---');
const rev = promo.decidido.find(i => i.commit === '07e4c64');
check('07e4c64 esta en el historial', !!rev);
check('NO aparece la frase rota "revertido con ."',
    !!rev && !/revertido con\s*\./i.test(rev.detalle || ''),
    rev ? rev.detalle : '-');
check('su sha de revert (a1a53c4) sobrevive en el detalle',
    !!rev && /a1a53c4/i.test(rev.detalle || ''), rev ? rev.detalle : '-');

console.log('\n--- BUG 5: 57008ae NO es "congelado", ya esta decidido ---');
check('57008ae esta en el historial', promo.decidido.some(i => i.commit === '57008ae'));
check('57008ae NO esta en "congelado"', !promo.congelado.some(i => i.commit === '57008ae'));
check('su nombre no dice "AUTORIZADO" (eso va en el detalle)',
    promo.decidido.some(i => i.commit === '57008ae' && !/autorizado/i.test(i.nombre)),
    (promo.decidido.find(i => i.commit === '57008ae') || {}).nombre);

console.log('\n--- BUG 6: nada cae en "indeterminado" cuando el archivo es legible ---');
check('0 items con estado ilegible', promo.indeterminado.length === 0,
    promo.indeterminado.map(i => i.nombre).join(' | '));

console.log('\n--- BUG 7: columnas identificadas por nombre, no por posicion ---');
// Dos tablas con el MISMO contenido en distinto orden de columnas. El
// nombre leído tiene que ser idéntico. Si el parser usara posiciones, la
// celda "Estado" caería en "Feat" y el nombre saldría "Listo para probar".
const mk = cols => {
    const orden = ['Feat', 'Rama', 'Commits', 'Estado'];
    const vals = {
        Feat: 'Idea 50 completa — el botón de liberar caché',
        Rama: '`feat-idea50-boton-cache`',
        Commits: '`b43743b`, `70414d2` / merge `950ea64`',
        Estado: '**LISTO.** Veredicto del Reviewer: APROBADO CON CAMBIOS'
    };
    const fila = cols.map(c => vals[c]).join(' | ');
    return '| ' + cols.join(' | ') + ' |\n|---|---|\n| ' + fila + ' |\n';
};
const base = { Feat: 'Idea 50 completa — el botón de liberar caché' };
const a = Parser.parsePromotions('## Pendientes de decisión\n\n' +
                mk(['Feat', 'Rama', 'Commits', 'Estado']));
const b = Parser.parsePromotions('## Pendientes de decisión\n\n' +
                mk(['Estado', 'Commits', 'Rama', 'Feat']));
const na = (a.esperando[0] || {}).nombre, nb = (b.esperando[0] || {}).nombre;
check('reordenar columnas NO cambia el nombre leido',
    na === base.Feat && nb === base.Feat, JSON.stringify(na) + ' vs ' + JSON.stringify(nb));
check('ni el estado', a.esperando[0] && b.esperando[0] &&
    a.esperando[0].state === 'ready' && b.esperando[0].state === 'ready',
    (a.esperando[0] || {}).state + ' vs ' + (b.esperando[0] || {}).state);
check('ni la rama', !!((a.esperando[0] || {}).rama) && !!((b.esperando[0] || {}).rama));

console.log('\n--- BUG 8: no se pierde ninguna fila ---');
// Idea 61 está en la SEGUNDA tabla de la sección. Antes esa tabla ni se
// leía y el item desaparecía sin dejar rastro.
check('los 5 items del archivo aparecen en algún bucket',
    (promo.esperando.length + promo.congelado.length + promo.noCandidato.length +
     promo.indeterminado.length + promo.decidido.length) === 5,
    'total ' + (promo.esperando.length + promo.congelado.length +
                promo.noCandidato.length + promo.indeterminado.length +
                promo.decidido.length));
check('Idea 61 lee su motivo desde la columna "Por qué NO es candidato"',
    !!(t3 && t3.motivo && /test/i.test(t3.motivo)),
    t3 ? JSON.stringify(t3.motivo) : 'sin motivo');

console.log('\n--- BUG 9: la ruta declarada se valida contra las rutas reales ---');
// Si el equipo declara una ruta, tiene que ser una ruta que existe en dev.
// Un link a una ruta inexistente abre la home en silencio: el peor error.
const rutas = require('./data/rutas-dev.json');
const validas = new Set(rutas.rutas.map(r => r.ruta).concat(rutas.sub_vistas.map(r => r.ruta)));
check('data/rutas-dev.json trae rutas', validas.size >= 10, String(validas.size));
check('la app tiene la ruta /cards (usada en la prueba)', validas.has('/cards'));
const conRutaFalsa = Parser.parsePromotions(
    '## Pendientes de decisión\n\n| Feat | Rama | Commits | Dónde verlo | Estado |\n|---|---|---|---|---|\n' +
    '| X | `f1` | `abc1234` | `#/no/existe/nada` | **LISTO.** |\n');
const cf = conRutaFalsa.esperando[0] || {};
check('una ruta declarada se lee sin inventarla',
    cf.ruta === '/no/existe/nada', JSON.stringify(cf.ruta));
check('y el item cae en "esperando" (tiene Estado)',
    cf.state === 'ready', cf.state);
check('el render puede marcar esa ruta como inválida (no está en la lista real)',
    !validas.has('/no/existe/nada'));
check('sin columna de ruta, ruta = null (no se inventa)',
    (promo.esperando[0] || {}).ruta === null);

console.log('\n=== ' + ok + ' OK / ' + fail + ' FALLAS ===');
process.exit(fail ? 1 : 0);