// tests/tab-drag-reorder.test.js
// 2026-10-05. Drag and drop de tabs del dashboard.
//
// No testing real de DOM: jsdom no tiene dataTransfer. Lo que pruebo es la
// lógica de reorden, que es la parte que puede romperse sin que nadie se
// de cuenta: splice en el array, guardado, y que el drop sobre el mismo
// elemento no mueva nada. El DOM se confirma a mano en el navegador.
//
// Uso: node tests/tab-drag-reorder.test.js

const assert = require('assert');

// --- Simulación del estado de app.js, sin DOM ---
const VALID_TABS = ['consultas', 'resumen', 'equipo', 'historial', 'proximas', 'promociones', 'salud', 'estructura', 'logs', 'notas'];

let tabOrder = null;
let stored = null;

function loadTabOrder() {
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === VALID_TABS.length
                && VALID_TABS.every(t => parsed.includes(t))) {
                tabOrder = parsed;
                return;
            }
        } catch (e) {}
    }
    tabOrder = VALID_TABS.slice();
}

function saveTabOrder() {
    stored = JSON.stringify(tabOrder);
}

function dropTab(from, to) {
    if (!from || !to || from === to) return false;
    if (!tabOrder) loadTabOrder();
    const i = tabOrder.indexOf(from);
    const j = tabOrder.indexOf(to);
    if (i === -1 || j === -1) return false;
    // splice(i,1) desplaza los índices posteriores: si i < j, el nuevo
    // índice de `to` es j-1. Sin este ajuste, arrastrar un botón hacia
    // la derecha lo dejaba un puesto más abajo del previsto.
    const item = tabOrder[i];
    tabOrder.splice(i, 1);
    const insertAt = i < j ? j - 1 : j;
    tabOrder.splice(insertAt, 0, item);
    saveTabOrder();
    return true;
}

let passed = 0;
let failed = 0;
function check(name, fn) {
    try { fn(); console.log('  ok  ' + name); passed++; }
    catch (e) { console.log('  FAIL ' + name + ' -> ' + e.message); failed++; }
}

// --- Test 1: default order es VALID_TABS ---
check('default order equals VALID_TABS', () => {
    stored = null;
    loadTabOrder();
    assert.deepStrictEqual(tabOrder, VALID_TABS);
});

// --- Test 2: drop de consultas sobre equipo lo mueve ---
check('drop consultas->equipo reorders', () => {
    stored = null;
    loadTabOrder();
    dropTab('consultas', 'equipo');
    assert.strictEqual(tabOrder[0], 'resumen');
    assert.strictEqual(tabOrder[1], 'consultas');
    assert.strictEqual(tabOrder[2], 'equipo');
});

// --- Test 3: drop sobre el mismo elemento no cambia nada ---
check('drop onto self is a no-op', () => {
    stored = null;
    loadTabOrder();
    const before = tabOrder.slice();
    const moved = dropTab('consultas', 'consultas');
    assert.strictEqual(moved, false);
    assert.deepStrictEqual(tabOrder, before);
});

// --- Test 4: drop de un tab que no esta en el orden falla silenciosamente ---
check('drop unknown tab is no-op', () => {
    stored = null;
    loadTabOrder();
    const before = tabOrder.slice();
    dropTab('inexistente', 'consultas');
    assert.deepStrictEqual(tabOrder, before);
});

// --- Test 5: storage corrupto cae al default ---
check('corrupt storage falls back to default', () => {
    stored = '{"mal formed';
    loadTabOrder();
    assert.deepStrictEqual(tabOrder, VALID_TABS);
});

// --- Test 6: storage con longitud distinta cae al default ---
check('wrong-length storage falls back', () => {
    stored = JSON.stringify(['consultas', 'resumen']);
    loadTabOrder();
    assert.deepStrictEqual(tabOrder, VALID_TABS);
});

// --- Test 7: storage con tabs validas pero incompleto cae al default ---
check('incomplete-but-valid storage falls back', () => {
    stored = JSON.stringify(['consultas', 'resumen', 'equipo', 'historial']);
    loadTabOrder();
    assert.deepStrictEqual(tabOrder, VALID_TABS);
});

// --- Test 8: drop inverso (equipo sobre consultas) ---
check('drop equipo->consultas reverses', () => {
    stored = null;
    loadTabOrder();
    dropTab('equipo', 'consultas');
    assert.strictEqual(tabOrder[0], 'equipo');
    assert.strictEqual(tabOrder[1], 'consultas');
});

// --- Test 9: dos drops seguidos se acumulan ---
check('two consecutive drops accumulate', () => {
    stored = null;
    loadTabOrder();
    dropTab('consultas', 'equipo');
    dropTab('historial', 'consultas');
    assert.strictEqual(tabOrder[0], 'resumen');
    assert.strictEqual(tabOrder[1], 'historial');
    assert.strictEqual(tabOrder[2], 'consultas');
    assert.strictEqual(tabOrder[3], 'equipo');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);