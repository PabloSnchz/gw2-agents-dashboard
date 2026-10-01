/**
 * _test_fichas.js — tests de la tab "qué construyó el equipo"
 *
 * Lo que se está probando NO es que el HTML se vea lindo. Es que no le
 * mienta a Pablo. Cada caso es una forma en que esta tab podría告诉他
 * algo falso:
 *
 *   - un link a una pantalla que no existe  → "la ruta no existe y yo lo invento"
 *   - un "0 features" cuando no se pudo leer el archivo → "no hay trabajo"
 *   - un campo en blancoPresented como si estuviera completo
 *   - una descripción cortada a la mitad
 *
 * Regla de los tests: si el caso no se puede distinguir en el HTML de
 * salida, el test no está probando lo que dice probar.
 */
const fs = require('fs');
global.window = global;
(0, eval)(fs.readFileSync('js/dev-catalogo.js', 'utf8'));
const D = window.DevCatalogo;

const CAT = require('./data/dev-catalogo.json');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
    if (cond) { pass++; }
    else { fail++; fails.push(msg); }
}

// ─────────────────────────────────────────────────────────────
// A. La ficha real de FEATURES.md
// ─────────────────────────────────────────────────────────────
const MD = fs.readFileSync('C:/Mis Archivos/GW2 online/gw2-dev/FEATURES.md', 'utf8');
const fx = D.parseFeatures(MD);

ok(fx.length === 1, `A1 se esperaba 1 ficha, hay ${fx.length}`);
const armeria = fx[0];
ok(armeria && armeria.nombre === 'Armería Legendaria', 'A2 nombre de la ficha');
ok(armeria.tipo === 'nueva', `A3 tipo, salió "${armeria && armeria.tipo}"`);
ok(armeria.estado === 'listo', `A4 estado, salió "${armeria && armeria.estado}"`);

// multilínea: la descripción tiene 3 líneas en el archivo
ok(armeria.campos.descripcion &&
   armeria.campos.descripcion.indexOf('Mi progreso') > 0,
   'A5 la descripción multilínea llegó completa (llegó: ' +
   (armeria.campos.descripcion || '').slice(-28) + ')');
ok((armeria.campos.commits.match(/[0-9a-f]{7}/g) || []).length === 7,
   'A6 los 7 commits se leyeron');

const htmlA = D.build(fx, CAT, null);
ok(htmlA.indexOf('Armería Legendaria') > 0, 'B1 la ficha aparece por nombre');
ok(htmlA.indexOf('pablosnchz.github.io/gw2-wallet-agents/#/account/legendary-armory') > 0,
   'B2 hay link REAL a la armería');
ok(htmlA.indexOf('Probando') === -1 && htmlA.indexOf('Probar en dev') > 0,
   'B3 el botón de prueba existe');
ok(htmlA.indexOf('Tenés que decidir') > 0, 'B4 está en el grupo de decisión');
ok(htmlA.indexOf('Trading Post') > 0, 'B5 la descripción se ve entera');

// ─────────────────────────────────────────────────────────────
// C. RUTA QUE NO EXISTE → no inventar link
// ─────────────────────────────────────────────────────────────
const MD_RUTA_FALSA = [
    '## Fichas', '',
    '## Pantalla inventada', '',
    '- **Tipo:** nueva',
    '- **Estado:** listo',
    '- **Dónde la veo:** no existe',
    '- **Ruta:** /no/existe/jamas',
    '- **Descripción:** algo',
    '- **Commits:** `abc1234`',
].join('\n');

const fxFalsa = D.parseFeatures(MD_RUTA_FALSA);
const htmlF = D.build(fxFalsa, CAT, null);
ok(fxFalsa.length === 1, 'C1 la ficha con ruta falsa se parsea');
ok(fxFalsa[0].linkVerificado === null, 'C2 la ruta inexistente NO se valida');
ok(htmlF.indexOf('/no/existe/jamas') === -1,
   'C3 la ruta inventada NO aparece como link en el HTML');
ok(htmlF.indexOf('Ruta no verificada') > 0, 'C4 se avisa que la ruta no se verificó');
ok(htmlF.indexOf('no existe') > 0, 'C5 el texto "dónde la veo" sigue visible');

// ─────────────────────────────────────────────────────────────
// D. FICHA SIN RUTA → no mandarla a ninguna pantalla
// ─────────────────────────────────────────────────────────────
const MD_SIN_RUTA = [
    '## Fichas', '',
    '## Cache invisible', '',
    '- **Tipo:** mejora oculta',
    '- **Estado:** listo',
    '- **Dónde la veo:** —',
    '- **Descripción:** baja 3 llamadas a la API',
    '- **Commits:** `def5678`',
    '- **Si no entra:** sigue tardando 2 s al arrancar',
    '- **Si sale mal:** datos viejos en pantalla si falla el cache',
].join('\n');

const fxSin = D.parseFeatures(MD_SIN_RUTA);
const htmlS = D.build(fxSin, CAT, null);
ok(htmlS.indexOf('pablosnchz.github.io') === -1,
   'D1 sin ruta declarada NO hay ningún link a la app');
ok(htmlS.indexOf('Sin pantalla') > 0, 'D2 dice que no tiene pantalla');
ok(htmlS.indexOf('baja 3 llamadas') > 0, 'D3 la descripción de la mejora oculta se ve');
ok(htmlS.indexOf('datos viejos en pantalla') > 0, 'D4 el riesgo se ve');
ok(htmlS.indexOf('sigue tardando 2 s') > 0, 'D5 qué pasa si no entra, se ve');
ok(htmlS.indexOf('MEJORA OCULTA') > 0, 'D6 la etiqueta de tipo es correcta');

// ─────────────────────────────────────────────────────────────
// E. SIN CATÁLOGO → las fichas siguen, pero sin links
// ─────────────────────────────────────────────────────────────
const htmlSinCat = D.build(fx, null, null);
ok(htmlSinCat.indexOf('Armería Legendaria') > 0, 'E1 sin catálogo, la ficha sigue');
ok(htmlSinCat.indexOf('pablosnchz.github.io') === -1,
   'E2 sin catálogo NO se fabrican links');
ok(htmlSinCat.indexOf('Ruta no verificada') > 0, 'E3 se explica por qué no hay link');

// ─────────────────────────────────────────────────────────────
// F. ERROR DE LECTURA → no es lo mismo que "no hay features"
// ─────────────────────────────────────────────────────────────
const htmlErr = D.build(null, CAT, 'HTTP 404');
ok(htmlErr.indexOf('HTTP 404') > 0, 'F1 el error se muestra');
ok(htmlErr.indexOf('NO significa que no haya trabajo') > 0,
   'F2 se aclara que no implica que no haya trabajo');
ok(htmlErr.indexOf('Armería') === -1, 'F3 no se dibuja ninguna ficha inventada');

// ─────────────────────────────────────────────────────────────
// G. ARCHIVO VACÍO
// ─────────────────────────────────────────────────────────────
const htmlVacio = D.build([], CAT, null);
ok(htmlVacio.indexOf('todavía') > 0, 'G1 avisa que el archivo está vacío');
ok(htmlVacio.indexOf('no puede decirte') > 0, 'G2 explica qué falta');

// ─────────────────────────────────────────────────────────────
// H. AGRUPACIÓN POR ACCIÓN
// ─────────────────────────────────────────────────────────────
const g = D.agrupar([
    { estado: 'listo' }, { estado: 'probado ok' }, { estado: 'autorizado' },
    { estado: 'rechazado' }, { estado: 'revertido' }, { estado: 'probado no va' },
]);
ok(g.decidir.length === 2, `H1 decisiones, hay ${g.decidir.length}`);
ok(g.produccion.length === 1, `H2 producción, hay ${g.produccion.length}`);
ok(g.descartado.length === 3, `H3 descartados, hay ${g.descartado.length}`);

// ─────────────────────────────────────────────────────────────
// I. ESTADO DESCONOCIDO → no se pierde la ficha
// ─────────────────────────────────────────────────────────────
const g2 = D.agrupar([{ estado: 'inventado por el equipo' }]);
ok(g2.decidir.length === 1, 'I1 un estado raro va a "decidir", no se pierde');
const g3 = D.agrupar([{}]);
ok(g3.decidir.length === 1, 'I2 sin estado definido se trata como "listo"');

// ─────────────────────────────────────────────────────────────
// J. ESCAPADO — nada de HTML crudo del archivo del equipo
// ─────────────────────────────────────────────────────────────
const MD_XSS = [
    '## Fichas', '',
    '## <img src=x onerror=alert(1)>', '',
    '- **Tipo:** nueva',
    '- **Descripción:** <script>alert("xss")</script>',
    '- **Commits:** `aaa1111`',
].join('\n');
const htmlX = D.build(D.parseFeatures(MD_XSS), CAT, null);
ok(htmlX.indexOf('<img src=x') === -1, 'J1 el nombre se escapa');
ok(htmlX.indexOf('<script>') === -1, 'J2 la descripción se escapa');

// ─────────────────────────────────────────────────────────────
// K. AVISO DE CAMPOS FALTANTES
// ─────────────────────────────────────────────────────────────
const htmlFalta = D.build(D.parseFeatures(MD_SIN_RUTA), CAT, null);
ok(htmlFalta.indexOf('faltan:') > 0, 'K1 avisa qué campos no escribió el equipo');

// ─────────────────────────────────────────────────────────────
// L. LA URL DE LA FUENTE
// Ya salió UN bug acá: getFeaturesUrl() usaba structureRepo*, que apunta
// a gw2-agents-dashboard, cuando FEATURES.md vive en gw2-wallet-agents.
// El 404 se leía como "el equipo no construyó nada" — la peor forma de
// estar equivocado: no se ve el error, se ve una conclusión falsa.
// ─────────────────────────────────────────────────────────────
global.DASHBOARD_CONFIG = undefined;
(0, eval)(fs.readFileSync('js/config.js', 'utf8'));
const CFG = global.DASHBOARD_CONFIG || global.window.DASHBOARD_CONFIG;
const u = CFG.getFeaturesUrl();
ok(u.indexOf('gw2-wallet-agents') > 0, 'L1 FEATURES.md se lee del repo de DESARROLLO');
ok(u.indexOf('gw2-agents-dashboard') === -1,
   'L2 NO se lee del repo del dashboard (ese no tiene el archivo)');
ok(u.endsWith('/FEATURES.md'), 'L3 la ruta del archivo es la correcta');
ok(CFG.getCatalogoUrl().indexOf('gw2-agents-dashboard') > 0,
   'L4 dev-catalogo.json sigue viniendo del dashboard (no se movió)');
ok(CFG.getCatalogoUrl() !== u,
   'L5 las dos fuentes son distintas: el equipo escribe una, yo genero la otra');

// una URL 404 tiene que ser RECONOCIBLE, no un fallo genérico
const html404 = D.build(null, CAT, 'HTTP 404');
ok(html404.indexOf('HTTP 404') > 0 && html404.indexOf('no haya trabajo hecho') > 0,
   'L6 un 404 se muestra como lo que es: no se pudo leer');

// ─────────────────────────────────────────────────────────────
console.log(`\n${pass} ok, ${fail} fallos\n`);
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('Las fichas muestran lo que el equipo escribió, y muestran — lo que no escribió.');