// _test_kpi_verdad.js — prueba del bloque "lo que está en producción, medido".
//
// Qué verifica, y por qué tiene que ser un archivo y no un node -e:
// los 4 KPIs se calculan de fuentes DISTINTAS y el riesgo real es que una de
// ellas vuelva a mentir sin que nadie lo note. Este test corre las dos ramas
// —con el medido presente y sin él— y falla si alguna afirma un número que
// no puede sostener.
//
// El control negativo importa tanto como el positivo: si el bloque medido
// apareciera con datos cuando el JSON no llegó, el panel estaría inventando.
const fs = require('fs');
const path = require('path');

// El test vive en tests/, y lo que exercise vive en la raíz del dashboard.
// __dirname solo, apuntaría a tests/ y el archivo de datos no estaría ahí.
const DASH = path.join(__dirname, '..');
const DEV = 'C:/Mis Archivos/GW2 online/gw2-dev';

global.window = {};
// El cruce con PROMOTIONS.md vive en dev-catalogo.js pero la fuente es
// parser.js. Este test los carga a los dos: antes cargaba solo dev-catalogo,
// y por eso veía 0 en producción — el cruce nunca tuvo con qué trabajar.
// Un 0 sobre un instrumento que no leyó el archivo no es un 0: es un test
// que no probó lo que dice probar.
const _fn = new Function('window',
    fs.readFileSync(path.join(DASH, 'js', 'parser.js'), 'utf8') + '\nreturn DashboardParser;');
const DashboardParser = _fn(global.window);
eval(fs.readFileSync(path.join(DASH, 'js', 'dev-catalogo.js'), 'utf8'));
const P = window.DevCatalogo;

const md = fs.readFileSync(path.join(DEV, 'FEATURES.md'), 'utf8');
const promoMd = fs.readFileSync(path.join(DEV, 'PROMOTIONS.md'), 'utf8');
const promo = DashboardParser.parsePromotions(promoMd);
global.window.__promoParsed = promo;
const cat = JSON.parse(fs.readFileSync(path.join(DASH, 'data', 'dev-catalogo.json'), 'utf8'));
const medido = JSON.parse(fs.readFileSync(path.join(DASH, 'data', 'prod-medido.json'), 'utf8'));

console.log('  registro de promociones: ' +
    Object.keys(promo).map(k => k + '=' + ((promo[k] || []).length || 0)).join(' '));

let fallos = 0;
function check(nombre, cond, detalle) {
    console.log((cond ? '  OK   ' : '  FALLA') + '  ' + nombre + (cond ? '' : '  <- ' + detalle));
    if (!cond) fallos++;
}

function render(m) {
    window.__prodMedido = m;
    const f = P.parseFeatures(md);
    P.construirLinks(f, cat);
    return { html: P.build(f, cat, null), n: f.length };
}

function kpis(html) {
    const n = [], l = [], s = [];
    const re = /feat-kpi__(?:n|l|src)">([^<]*)</g;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (re.lastIndex, false) { /* no-op */ }
        const k = m[0].match(/__(\w+)">/)[1];
        (k === 'n' ? n : k === 'l' ? l : s).push(m[1]);
    }
    return { n, l, s };
}

console.log('== rama CON el medido ==');
const A = render(medido);
const ka = kpis(A.html);
console.log('  fichas: ' + A.n);
console.log('  KPI:');
for (let i = 0; i < ka.l.length; i++) {
    console.log('    ' + String(ka.n[i]).padStart(3) + '  ' + ka.l[i].padEnd(22) + ' (' + ka.s[i] + ')');
}

check('el parser ya no descarta fichas (>12)', A.n > 12, 'sigue en ' + A.n);
check('el bloque medido se dibuja', A.html.includes('feat-medido'), 'no esta');
check('el bloque medido NO dice "no se pudo medir"', !A.html.includes('No se pudo medir'), 'se dibujó el fallback con datos presentes');

// ── el cruce con PROMOTIONS.md ────────────────────────────────────────────
// Este es el check que fallaba antes, y valía la pena: el KPI decía 0 en
// producción con la Armería autorizada en PROMOTIONS.md:77.
//
// El 0 era del INSTRUMENTO, no de la realidad. Las fichas de FEATURES.md se
// clasifican por su campo `Estado:` (que el equipo escribe al crear la ficha y
// nadie actualiza al promover), y solo se cruzaban contra el registro de
// promociones —que sí se escribe en el momento del acto— si ese registro
// estaba cargado. Este test no lo cargaba, así que medía la rama del fallback
// y reportaba 0 con toda seguridad.
//
// Por eso el assert no es "el número es tal": es que el número SALGA del cruce
// y sea >0 con el registro presente. Si mañana la Armería se revierte y la
// ficha deja de cruzarse, este check tiene que avisar.
const iProd = ka.l.indexOf('en producción');
check('el KPI "en producción" existe', iProd >= 0, ka.l.join(' | '));
check('el registro de promociones tiene decisiones',
      ((promo.decidido || []).length + (promo.prodSinVerificar || []).length) > 0,
      JSON.stringify(Object.keys(promo)));
check('el cruce encuentra lo promovido (>0)',
      iProd >= 0 && Number(ka.n[iProd]) > 0,
      'en producción = ' + (iProd >= 0 ? ka.n[iProd] : '?'));
check('ese KPI declara que sale del registro, no de una etiqueta',
      iProd >= 0 && /registro/.test(ka.s[iProd] || ''),
      'fuente=' + (iProd >= 0 ? ka.s[iProd] : '?'));
check('la Armería aparece como producida',
      A.html.indexOf('Armería Legendaria') > 0 &&
      !/Armería Legendaria[\s\S]{0,400}?Tenés que decidir/.test(A.html),
      'no se encuentra la ficha');
check('cada KPI declara su origen',
      ka.s.length === ka.l.length && ka.s.every(s => s && s.length > 0),
      JSON.stringify(ka.s));

check('hay un KPI "sin pantalla propia"', ka.l.indexOf('sin pantalla propia') >= 0, ka.l.join(' | '));
check('NO queda el KPI viejo "sin link verificable"', ka.l.indexOf('sin link verificable') < 0, 'quedo el viejo');
check('dice cuantos identificos hay', A.html.indexOf('archivos idénticos') > 0, 'falta el conteo');
check('nombra el modulo que falta de produccion',
    A.html.indexOf('homestead-tracker.js') > 0 || medido.archivos.solo_dev_webapp === 0,
    'faltante no listado');

console.log('');
console.log('== rama SIN el medido (control negativo) ==');
const B = render(null);
const kb = kpis(B.html);
check('el fallback aparece', B.html.includes('No se pudo medir'), 'no aparece el aviso');
check('NO inventa numeros de produccion', !/de \d+ archivos idénticos/.test(B.html), 'se invento el conteo');
check('las fichas se siguen contando igual', kb.n[0] === ka.n[0], 'cambio el conteo sin el medido');
check('el parser no depende del medido', B.n === A.n, B.n + ' vs ' + A.n);

console.log('');
console.log(fallos === 0 ? 'TODOS LOS CHECKS PASARON' : fallos + ' CHECK(S) FALLARON');
process.exit(fallos === 0 ? 0 : 1);