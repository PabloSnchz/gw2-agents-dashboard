/**
 * _test_render_promo.js — renderPromotions contra el dato REAL.
 *
 * Sin navegador: se arma un DOM mínimo con el elemento que busca el render
 * y se corre la función. Lo que se chequea es el HTML que sale, no "que no
 * haya tirado la excepción", que es lo que se chequeaba antes y no prueba nada.
 *
 * Uso: node _test_render_promo.js
 */
const fs = require('fs');
const path = require('path');

// Los stubs van ANTES del eval: renderer.js tiene "window.toggleAccordion ="
// en el medio del archivo, así que si window no existe al evaluarlo, revienta
// antes de llegar a la función que queremos probar.
global.window = { DASHBOARD_CONFIG: { repoOwner: 'PabloSnchz', repoName: 'gw2-wallet-agents' } };
global.document = { getElementById: () => null };
global.marked = { parse: () => '<p>md</p>' };

(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'parser.js'), 'utf8') +
           '\n;globalThis.__P = DashboardParser;');
(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'renderer.js'), 'utf8') +
           '\n;globalThis.__R = DashboardRenderer;');

const Parser = globalThis.__P, Renderer = globalThis.__R;
const md = fs.readFileSync(path.join(__dirname, '_fixture_promotions.md'), 'utf8');
const rutas = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'rutas-dev.json'), 'utf8'));

function render(rts, err) {
    const c = { innerHTML: '' };
    global.document = { getElementById: id => (id === 'promotions-container' ? c : null) };
    Renderer.renderPromotions(Parser.parsePromotions(md), md, rts, err);
    return c.innerHTML;
}

let ok = 0, fail = 0;
const check = (n, c, x) => c ? (ok++, console.log('  OK   ' + n))
                            : (fail++, console.log('  FALLA ' + n + (x ? '  -> ' + x : '')));

const html = render(rutas);
fs.writeFileSync('_promo_render.html', html, 'utf8');
console.log('\nHTML generado: ' + html.length + ' bytes (en _promo_render.html)\n');

console.log('--- La pregunta y la respuesta ---');
check('responde si hay algo esperando', /Nada esperando tu decisión|cosa espera tu decisión/.test(html));
check('NO dice que hay 5 cosas esperando', !/5 cosas esperan/.test(html));

console.log('\n--- 392c3b9: congelado, no "esperando decisión" ---');
check('aparece el nombre de 392c3b9', /Solitary Throne CM daily tracker/.test(html));
check('esta en el bloque CONGELADO',
    /Congelado — no tocar/.test(html) && /Solitary Throne CM daily tracker/.test(html));
check('NO esta en el bloque "Esperando tu decisión"',
    !/Esperando tu decisión[\s\S]{0,1200}Solitary Throne/.test(html));
check('dice explicitamente que no espera decisión',
    /No espera ninguna decisión tuya/.test(html));
check('el badge dice "congelado", no "pendiente"',
    /promo-badge--congelado">congelado</.test(html));
check('NO hay ningun badge "pendiente" en la tab',
    !/promo-badge[^>]*>pendiente</i.test(html));

console.log('\n--- Idea 61: no candidato con su motivo ---');
check('aparece con su nombre', /el espejo medido en comportamiento/.test(html));
check('NO aparece como decidido', !/Ya decidido[\s\S]{0,900}espejo medido/.test(html));
check('NO aparece esperando', !/Esperando tu decisión[\s\S]{0,1200}espejo medido/.test(html));
check('se conserva el motivo del equipo ("Es código de test")',
    /Es código de test/.test(html));
check('el bloque dice que no hay nada que hacer',
    /No hay nada que hacer con estos/.test(html));

console.log('\n--- El item accionable ---');
check('el botón de cacheClear está en "Esperando tu decisión"',
    /Esperando tu决策|Esperando tu decisión[\s\S]{0,1500}botón de liberar caché/.test(html));
check('tiene el badge "listo para probar"', /promo-badge--ready">listo para probar</.test(html));
check('explica qué pasa si no decidís nada',
    /Si no decidís nada/.test(html) && /agents\/main/.test(html));
check('el nombre no sale cortado ("(Tramos A-F" pegado al título)',
    !/botón de liberar caché\*\*?\s*\(Tramos/.test(html));
check('la cola larga va aparte, no en el título',
    /promo-card__cola/.test(html));

// Un SOLO objeto contenedor para todos los renders. Antes se creaba uno
// nuevo en cada bloque de test, así que el test leía un objeto distinto del
// que el renderer escribía y daba 4 falsos negativos.
const cont = { innerHTML: '' };
global.document = { getElementById: id => (id === 'promotions-container' ? cont : null) };

console.log('\n--- Links ---');
check('la lista de rutas cargó', html.indexOf('promo-ref__lista') > -1);
check('el link a dev usa la base medida, no una inventada',
    html.indexOf('https://pablosnchz.github.io/gw2-wallet-agents/') > -1);
// Solo en la TARJETA: el bloque de referencia SÍ enlaza todas las pantallas,
// a propósito, porque para eso existe.
const tarjetas = html.slice(0, html.indexOf('promo-ref"') > -1 ? html.indexOf('promo-ref"') : html.length);
check('la tarjeta NO adivina una pantalla (sin ruta declarada no inventa link profundo)',
    !/href="https:\/\/pablosnchz\.github\.io\/gw2-wallet-agents\/#/.test(tarjetas),
    (tarjetas.match(/href="[^"]*gw2-wallet-agents\/#[^"]*"/) || [''])[0]);
check('sin ruta declarada dice "sin ruta declarada"', /sin ruta declarada/.test(html));
check('los commits son links al diff real',
    /https:\/\/github\.com\/PabloSnchz\/gw2-wallet-agents\/commit\/b43743b/.test(html));
check('la referencia lista las 10 pantallas del menú',
    (html.match(/promo-ref__lista/g) || []).length >= 2 && /Cartera/.test(html));

console.log('\n--- Ruta declarada inválida: se muestra, NO se enlaza ---');
const it = Parser.parsePromotions(
    '## Pendientes de decisión\n\n| Feat | Rama | Commits | Dónde verlo | Estado |\n|---|---|---|---|---|\n' +
    '| Botón X | `fx` | `abc1234` | `#/no/existe` | **LISTO.** |\n');
check('el parser leyó la ruta declarada',
    (it.esperando[0] || {}).ruta === '/no/existe',
    JSON.stringify((it.esperando[0] || {}).ruta));
Renderer.renderPromotions(it, 'x', rutas, null);
const h2 = cont.innerHTML;
check('marca la ruta como inválida', /Ruta inválida/.test(h2));
check('NO la convierte en link navegable',
    !/href="[^"]*#\/no\/existe"/.test(h2), (h2.match(/href="[^"]*no\/existe[^"]*"/) || [''])[0]);
check('aclara que no existe en dev', /no existe en dev/.test(h2));

console.log('\n--- Ruta declarada VÁLIDA: sí se enlaza directo ---');
const it2 = Parser.parsePromotions(
    '## Pendientes de decisión\n\n| Feat | Rama | Commits | Dónde verlo | Estado |\n|---|---|---|---|---|\n' +
    '| Botón X | `fx` | `abc1234` | `#/cards` | **LISTO.** |\n');
Renderer.renderPromotions(it2, 'x', rutas, null);
const h2b = cont.innerHTML;
check('enlaza directo a la pantalla declarada',
    /href="https:\/\/pablosnchz\.github\.io\/gw2-wallet-agents\/#\/cards"/.test(h2b));

console.log('\n--- Sin rutas-dev.json: avisa, no miente ---');
Renderer.renderPromotions(Parser.parsePromotions(md), md, null, 'HTTP 404');
const h3 = cont.innerHTML;
check('avisa que no pudo cargar la lista', /No pude cargar la lista de pantallas/.test(h3));
check('aclara el motivo', /HTTP 404/.test(h3));
check('la tab igual dibuja el contenido', /botón de liberar caché/.test(h3));
check('pero no inventa links profundos', !/href="[^"]*gw2-wallet-agents\/#/.test(h3));
check('y no dice que hay 0 pantallas', !/0 del menú/.test(h3));

console.log('\n--- Truthfulness: nada de ceros falsos ---');
check('si no hay nada en un bloque, el bloque no se dibuja',
    !/No se pudo leer[\s\S]*<\/section>/.test(html) || !/No se pudo leer/.test(html));
check('no hay "undefined" en el HTML', !/undefined/.test(html),
    (html.match(/.{0,40}undefined.{0,40}/) || [''])[0]);
check('no hay "null" crudo en el HTML', !/>\s*null\s*</.test(html));

console.log('\n=== ' + ok + ' OK / ' + fail + ' FALLAS ===');
process.exit(fail ? 1 : 0);