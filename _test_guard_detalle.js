/**
 * _test_guard_detalle.js — la configuración real de la rama de producción
 *
 * Antes de este cambio el panel solo sabía decir "protegida" / "abierta", y
 * su pie afirmaba que la configuración "no se puede leer sin token". Eso era
 * falso y, peor, hacía que el caso peligroso pasara desapercibido:
 *
 *   una ruleset que PROTEGE main pero NO exige pull request.
 *
 * Con ese dato, "Protegida" en verde significa literalmente que cualquiera con
 * permiso de escritura puede pushear a main sin pasar por Pablo. El panel
 * mostraba un escudo verde.
 *
 * Estos tests fijan las cuatro cosas que el render NO puede hacer:
 *   1. no inventar "Sí"/"No" sobre un campo que no vino (null → "sin dato")
 *   2. no callar ante protección sin PR / admins que la saltean
 *   3. no gritar ante desarrollo y dashboard, que están abiertos A PROPÓSITO
 *   4. decir POR QUÉ no se pudo leer, en vez de fingir cobertura
 *
 * Corre: node _test_guard_detalle.js
 */
const fs = require('fs');
const path = require('path');

global.window = { DASHBOARD_CONFIG: { getGitDataUrl: () => 'data/git.json' } };
const cont = { innerHTML: '' };
global.document = { getElementById: id => (id === 'guard-container' ? cont : null) };
global.fetch = async () => ({ ok: true, json: async () => globalThis.__JSON });

(0, eval)(fs.readFileSync(path.join(__dirname, 'js', 'production-guard.js'), 'utf8') +
           '\n;globalThis.__G = ProductionGuard;');
const G = globalThis.__G;

let pass = 0, fail = 0;
const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }

function repo(over) {
    return Object.assign({
        repo: 'x', label: 'x', role: 'dev', sha: 'a1b2c3d',
        short_sha: 'a1b2c3d', commit: 'feat: algo', estado: 'open',
        protected: false, protected_fresco: true,
        protected_verificado_utc: '20261001T120000Z',
        proteccion_detalle: null, proteccion_detalle_motivo: null
    }, over);
}

const BUENA = {
    pr_requerida: true, aprobaciones_requeridas: 1, rechazos_descartados: true,
    admins_sujetos: true, restricciones: 'ninguna', force_push_permitido: false,
    borrado_permitido: false, status_checks_requeridos: 2,
    conversaciones_resueltas: true
};

async function render(repos) {
    globalThis.__JSON = { repos };
    cont.innerHTML = '';
    await G.render();
    return cont.innerHTML;
}

// --- 1. producción protegida Y bien configurada: escudo, cero alarmas ----
console.log('\n1) producción protegida que SI exige pull request y sujeta a los admins');
(async () => {
let h = await render([
    repo({ repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production',
           estado: 'protected', protected: true,
           proteccion_detalle: BUENA, proteccion_detalle_motivo: null })
]);
ok(h.includes('Protegida'), 'dice Protegida');
ok(h.includes('Exige pull request'), 'lista las reglas');
ok(h.includes('guard-rules'), 'renderiza la lista de reglas');
ok(!h.includes('guard-alert'), 'NO dispara alarma cuando la invariante se cumple');
ok(h.includes('Aprobaciones que exige'), 'muestra cuantas aprobaciones');
ok(h.includes('Status checks') && h.includes('2'), 'muestra los status checks');
ok(h.includes('solo usuarios/equipos del repo') === false, 'restricciones="ninguna" no se maquilla');
ok(h.includes('cualquiera con escritura'), 'restricciones ninguna se dice textual');
ok(h.includes('observa') && h.includes('no activa ni desactiva nada'),
   'el pie aclara que no toca nada');

// --- 2. EL CASO QUE ANTES PASABA DESAPARCIBIDO --------------------------
console.log('\n2) protegida pero SIN pull request y con admins que la saltean');
h = await render([
    repo({ repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production',
           estado: 'protected', protected: true,
           proteccion_detalle: Object.assign({}, BUENA, {
               pr_requerida: false, admins_sujetos: false,
               force_push_permitido: true, borrado_permitido: true }) })
]);
ok(h.includes('Protegida'), 'sigue diciendo Protegida (el dato es real)');
ok(h.includes('guard-alert'), 'pero dispara la alarma');
ok(h.includes('NO exige pull request'), 'nombra el problema real');
ok(h.includes('saltear la protección'), 'nombra el bypass de admins');
ok(h.includes('force-push'), 'nombra el force-push');
ok(h.includes('borrar la rama main'), 'nombra el borrado');

// --- 3. sin token: NO puede fingir cobertura ------------------------------
console.log('\n3) protegida pero sin detalle (sin token)');
h = await render([
    repo({ repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production',
           estado: 'protected', protected: true,
           proteccion_detalle: null, proteccion_detalle_motivo: 'sin token' })
]);
ok(h.includes('Configuración no leída'), 'avisa que no pudo leer');
ok(h.includes('sin token'), 'dice POR QUÉ');
ok(!h.includes('guard-rules'), 'no inventa la lista de reglas');
ok(!h.includes('guard-alert'), 'no grita: no sabe, no afirma que esté mal');
ok(h.includes('Administration: read'), 'el pie dice qué falta para poder leerlo');
ok(!h.includes('no se puede leer sin token'),
   'el pie viejo ("no se puede leer") ya no se usa como excusa permanente');

// --- 4. desarrollo y dashboard: abiertos a propósito, cero ruido ---------
console.log('\n4) desarrollo y dashboard abiertos a propósito');
h = await render([
    repo({ repo: 'gw2-agents-dashboard', label: 'Dashboard', role: 'dashboard' }),
    repo({ repo: 'gw2-wallet-agents', label: 'Desarrollo', role: 'dev' }),
    repo({ repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production',
           estado: 'protected', protected: true, proteccion_detalle: BUENA })
]);
ok(!h.includes('guard-alert'), 'abrir desarrollo/dashboard NO dispara alarma');
ok(h.includes('Abierta (esperado)'), 'y se marca como esperado');
ok((h.match(/guard-rules/g) || []).length === 1,
   'la lista de reglas aparece SOLO en producción (1 vez), no en los otros 2');

// --- 5. producción sin protección: la alarma de siempre ----------------
console.log('\n5) producción sin protección');
h = await render([
    repo({ repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production',
           estado: 'open', protected: false, protected_fresco: true,
           proteccion_detalle_motivo: 'sin proteccion configurada' })
]);
ok(h.includes('guard-alert'), 'dispara alarma');
ok(h.includes('NO tiene protección'), 'nombra el problema');
ok(!h.includes('SIN PROTECCIÓN'), 'la etiqueta no se duplica con la alarma');

console.log('\n' + pass + ' ok, ' + fail + ' en rojo');
fails.forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
})();
