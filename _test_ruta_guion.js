/**
 * _test_ruta_guion.js — un guion es AUSENTE, no "terminó en guion"
 *
 * El defecto: el equipo escribe `` `—` `` con backticks y a veces seguido de
 * un paréntesis. "`—`" no es igual a "—", así que un campo VACÍO se leía
 * como "declaró una ruta que no existe".
 *
 * Y el síntoma era peor que un texto feo: la etiqueta decía "Ruta no
 * verificada", que acusa a alguien de haber inventado una ruta. Nadie la
 * inventó — la dejaron en blanco, que es lo correcto cuando no hay pantalla.
 *
 * Este test existe porque el que escribe es un LLM. No puedo obligarlo a ser
 * breve; sí puedo hacer que el que lee lo entienda.
 */
const fs = require('fs');
const path = require('path');

global.window = { DASHBOARD_CONFIG: {} };
global.document = { getElementById: () => null };
(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'dev-catalogo.js'), 'utf8') +
    '\n;globalThis.__D = window.DevCatalogo;');
const D = globalThis.__D;

let pass = 0, fail = 0; const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }

// ─────────────────────────────────────────────────────────────
// A. El caso que fallaba, con las tres formas de escribirlo
// ─────────────────────────────────────────────────────────────
// build() DEVUELVE el html; no escribe en el DOM. Capturar un
// getElementById acá devolvería siempre '' y todos los asserts fallarían
// por una razón que no tiene nada que ver con lo que se está probando.
function render(ruta, pantalla) {
    const md = [
        '# Catálogo de developments', '',
        '## Ficha de prueba', '',
        '- **Tipo:** mejora oculta',
        '- **Estado:** listo',
        '- **Dónde la veo:** —',
        '- **Ruta:** ' + ruta,
        '- **Descripción:** x', '- **Commits:** `abc1234`',
        '- **Rama:** —', '- **Si no entra:** x', '- **Si sale mal:** x',
    ].join('\n');
    const cat = { pantallas: pantalla ? [{ ruta: pantalla, url: 'u', nombre: 'P' }] : [] };
    return D.build(D.parseFeatures(md), cat, null) || '';
}

const NO = 'Sin pantalla';
const NOVERIF = 'Ruta no verificada';

ok(render('—', null).indexOf(NO) > 0,
   'A1 guion pelado => Sin pantalla');
ok(render('`—` (no tiene pantalla propia)', null).indexOf(NO) > 0,
   'A2 guion con backticks y paréntesis => Sin pantalla (ERA "Ruta no verificada")');
ok(render('`—`', null).indexOf(NO) > 0,
   'A3 guion con backticks solo => Sin pantalla');
ok(render('-', null).indexOf(NO) > 0,
   'A4 guion corto también es ausencia');

// ─────────────────────────────────────────────────────────────
// B. La distinguishing que NO puede perderse
// ─────────────────────────────────────────────────────────────
const inv = render('/account/inventada', null);
ok(inv.indexOf(NOVERIF) > 0,
   'B1 una ruta que NO existe en el catálogo sigue diciendo "no verificada"');
ok(inv.indexOf(NO) === -1,
   'B2 y NO dice "Sin pantalla": son dos cosas distintas y no se pueden parecer');
const real = render('/account/accounts', '/account/accounts');
ok(real.indexOf('Probar en dev') > 0,
   'B3 una ruta REAL da link, aunque venga con paréntesis explicativo');
ok(render('#/account/accounts', '/account/accounts').indexOf('Probar en dev') > 0,
   'B4 acepta las dos formas de escribir la ruta (con y sin #)');

// ─────────────────────────────────────────────────────────────
// C. Una ruta no puede subirse texto encima
// ─────────────────────────────────────────────────────────────
ok(render('/account/accounts (el panel, no la app)', '/account/accounts')
    .indexOf('Probar en dev') > 0,
   'C1 el paréntesis no rompe una ruta válida');

// ─────────────────────────────────────────────────────────────
// D. Contra las fichas reales
// ─────────────────────────────────────────────────────────────
const realMd = fs.readFileSync('C:/Mis Archivos/GW2 online/gw2-dev/FEATURES.md', 'utf8');
const catReal = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'dev-catalogo.json'), 'utf8'));
const fichas = D.parseFeatures(realMd);
D.construirLinks(fichas, catReal);

// >= 0, no === 0: "mejora oculta" tiene "oculta" en la posición 6, no en la 0.
const ocultas = fichas.filter(f => (f.campos.tipo || '').indexOf('oculta') >= 0);
ok(ocultas.length === 2, `D1 hay 2 mejoras ocultas, hay ${ocultas.length}`);
ocultas.forEach(f => {
    ok(!f.linkVerificado, `D2 "${f.nombre}" no debe tener link: no se ve en ninguna pantalla`);
});

// Ninguna ficha puede declarar una ruta que el catálogo medido no tenga.
fichas.forEach(f => {
    const r = String(f.campos.ruta || '').replace(/`/g, '').trim().split(/\s+/)[0].replace(/^#/, '');
    if (!r || r === '—' || r === '-') return;
    ok(!!catReal.pantallas.find(p => p.ruta === r),
       `D3 "${f.nombre}" declara ${r} y no está en el catálogo de dev`);
});

console.log(`\n${pass} ok, ${fail} fallos\n`);
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('Un guion es "no hay", no "declaré algo raro".');