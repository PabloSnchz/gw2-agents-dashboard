/**
 * tests/parser-nullguard.test.js — 2026-10-06.
 *
 * El bug: fetchFile devuelve content=null cuando el .md no existe (404) o
 * hay error de red. El parser lo pasaba directo a .split('\n') y tiraba
 * `text.split is not a function`. Eso cortaba todo loadAll y el panel quedaba
 * vacío con un error en la barra.
 *
 * Este test lo que hace es congelar el contrato: NINGÚN método del parser
 * puede tirar TypeError por null de entrada. Si alguien rompe eso, el test
 * falla y el panel vuelve a morir.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Cargar parser.js como módulo: está escrito como class global, así que
// lo leemos, le quitamos la última línea (window.DASHBOARD_CONFIG = … no,
// esa es de config.js) y lo evaluamos con un scope fake.
const parserSrc = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'parser.js'),
    'utf8'
).replace(/window\.DASHBOARD_CONFIG\s*=\s*DASHBOARD_CONFIG;/, '');

// Evaluar en un scope con `window` y `DASHBOARD_CONFIG` definidos.
const sandbox = { window: {}, DASHBOARD_CONFIG: {} };
const fn = new Function('window', 'DASHBOARD_CONFIG', parserSrc + '\n; return DashboardParser;');
const DashboardParser = fn(sandbox.window, sandbox.DASHBOARD_CONFIG);

const METHODS = [
    'parseTeamStatus',
    'parseAlerts',
    'parseComms',
    'parseCommunications',
    'parseSessionLog',
    'parseEscalations',
    'parseCronSchedule',
    'parsePoIdeas',
    'parseCommsDetails',
    'parseReadyForPromotion',
    'parseInProgress',
    'parseUpcoming',
    'parseOrgMap',
    'parsePromotions',
    'parsePreBacklog',
    'parseBacklog',
    'parseFeatures'
];

let passed = 0;
let failed = 0;

METHODS.forEach(name => {
    const fn2 = DashboardParser[name];
    if (typeof fn2 !== 'function') {
        console.log(`SKIP ${name}: no es método`);
        return;
    }

    // Casos de entrada que antes rompían.
    const inputs = [null, undefined, '', '   ', 0, false];

    inputs.forEach(inp => {
        try {
            const result = fn2.call(DashboardParser, inp);
            assert.ok(result, `${name}(${JSON.stringify(inp)}) devolvió ${result}`);
            assert.ok(typeof result === 'object', `${name} devolvió no-object`);
            passed++;
        } catch (e) {
            console.error(`FAIL ${name}(${JSON.stringify(inp)}): ${e.message}`);
            failed++;
        }
    });
});

console.log(`\nparser-nullguard: ${passed} pasados, ${failed} fallados`);
process.exit(failed > 0 ? 1 : 0);