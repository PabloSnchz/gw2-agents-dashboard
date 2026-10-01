/**
 * js/production-guard.js
 * Watchdog de protección de producción.
 *
 * NO consulta la API: lee data/git.json, que _eco\git_export.py calcula en el
 * pulso de 15 min. Cada carga del navegador usa 0 requests a api.github.com.
 *
 * El booleano "protegida" lo da la API pública. La CONFIGURACIÓN (si exige
 * pull request, cuántos approvals, si los admins la saltean, force-push)
 * solo aparece si el pulso tiene GW2_GH_TOKEN en el entorno, porque
 * /branches/main/protection exige Administration: read. Cuando el token no
 * está, el panel lo dice explícito en vez de asumir que "protegida" es
 * "segura": una ruleset puede proteger la rama sin exigir ni un PR.
 *
 * Cuando el detalle sí llega, este bloque OBSERVA. No activa, no desactiva,
 * no modifica nada:_settings las cambia Pablo.
 */

const REPOS_GUARD = [
    { repo: 'gw2-wallet-ligero', label: 'Producción', role: 'production' },
    { repo: 'gw2-wallet-agents', label: 'Desarrollo', role: 'dev' },
    { repo: 'gw2-agents-dashboard', label: 'Dashboard', role: 'dashboard' }
];

const ProductionGuard = {
    async check() {
        // Lee data/git.json, pre-calculado en _eco\git_export.py y publicado
        // con el pulso cada 15 min. Antes eram 3 fetch a branches/main contra
        // api.github.com; con la cuota anonima (60/h POR IP) agotada los 3
        // daban 403 y las 3 tarjetas caian en "No verificable" sin poder
        // distinguir "rama abierta" de "no pude preguntar".
        // TODO (incluido obtener la URL) va DENTRO del try: si getGitDataUrl()
        // falla, el catch devuelve tarjetas visibles en vez de rechazar. Si
        // el throw escapa, render() nunca resuelve y el panel queda colgado
        // en "Leyendo el estado de git..." para siempre. Un panel que se
        // queda cargando sin error es el peor estado posible: ni dice que
        // fallo, ni admiten que fallo.
        try {
            const cfg = window.DASHBOARD_CONFIG;
            if (!cfg || !cfg.getGitDataUrl) {
                return this._todosUnknown('DASHBOARD_CONFIG no cargó');
            }
            const url = cfg.getGitDataUrl() + '?t=' + Date.now();
            const res = await fetch(url);
            if (!res.ok) return this._todosUnknown('HTTP ' + res.status + ' al leer data/git.json');
            const data = await res.json();
            if (!data || !Array.isArray(data.repos)) {
                return this._todosUnknown('data/git.json no tiene la forma esperada');
            }
            return data.repos.map(r => ({
                repo: r.repo,
                label: r.label,
                role: r.role,
                state: r.estado,               // 'protected' | 'open' | 'unknown'
                lastSha: r.short_sha,
                lastCommit: r.commit,
                // 'protected' llega cacheado con TTL de 6 h (es el unico
                // campo que solo la API REST da). Si vino de cache y el
                // estado es 'open', NO es igual de confiable que uno recien
                // verificado: lo marcamos aparte para no mentir.
                cached: r.protected_fresco === false,
                checkedAt: r.protected_verificado_utc,
                // Configuracion real de la rama, si el pulso pudo leerla con
                // token. Antes esto no existia: el panel afirmaba que no se
                // podia leer nunca, y por eso nadie sabia si main exigia PR.
                detalle: r.proteccion_detalle || null,
                detalleMotivo: r.proteccion_detalle_motivo || null
            }));
        } catch (e) {
            return this._todosUnknown(e.message);
        }
    },

    _todosUnknown(reason) {
        return REPOS_GUARD.map(r => Object.assign({}, r, {
            state: 'unknown', reason, cached: false, lastSha: null, lastCommit: null
        }));
    },

    async render() {
        const container = document.getElementById('guard-container');
        if (!container) return;

        container.innerHTML = '<p class="guard-loading">Leyendo el estado de git&hellip;</p>';

        const results = await this.check();
        const now = new Date().toLocaleTimeString();

        const cards = results.map(r => {
            let tone, icon, label;

            if (r.state === 'protected') {
                tone = 'ok'; icon = '🛡️'; label = 'Protegida';
            } else if (r.state === 'open') {
                const critico = (r.role === 'production' || r.role === 'dashboard');
                tone = critico ? 'danger' : 'neutral';
                icon = critico ? '🚨' : '🔓';
                // Si producción ya tiene una alerta abajo que explica el motivo
                // ("la rama main NO tiene protección"), repetirlo en MAYÚSCULAS
                // en la esquina es gritar lo mismo dos veces. La etiqueta
                // nombra el estado; la alerta explica la consecuencia.
                label = (r.role === 'production' && this._problemasProd(r).length)
                    ? 'Abierta'
                    : (critico ? 'SIN PROTECCIÓN' : 'Abierta (esperado)');
            } else {
                tone = 'neutral'; icon = '❓'; label = 'No verificable';
            }

            let detail;
            if (r.state === 'unknown') {
                detail = this._escape(r.reason || 'Sin dato');
            } else {
                detail = r.lastCommit
                    ? 'Último <code>' + this._escape(r.lastSha) + '</code> — ' + this._escape(this._shorten(r.lastCommit, 70))
                    : 'Último <code>' + this._escape(r.lastSha || '—') + '</code>';
                // La protección puede venir cacheada. Un "abierta" cacheado
                // todavía dispara la alarma, pero se marca como leído viejo
                // para que Pablo sepa cuánto pesa ese dato.
                if (r.cached && r.state === 'open') {
                    detail += ' <em>(protección cacheada: ' +
                        this._escape(this._humanTs(r.checkedAt)) + ')</em>';
                }
            }

            // El detalle solo se muestra en produccion: desarrollo y dashboard
            // estan desprotegidos A PROPOSITO (es la decision de que la
            // barrera dura sea produccion), asi que listar "no exige PR" ahi
            // seria ruido que se lee como alarma.
            const reglas = (r.role === 'production' && r.detalle)
                ? this._reglasDe(r.detalle)
                : '';
            const sinLeer = (r.role === 'production' && r.state !== 'unknown' && !r.detalle)
                ? '<p class="guard-detail"><em>Configuración no leída: ' +
                  this._escape(r.detalleMotivo || 'el pulso no informó por qué') +
                  '. "Protegida" no dice si exige pull request.</em></p>'
                : '';

            return `
                <div class="guard-card guard-card--${tone}">
                    <div class="guard-top">
                        <span class="guard-icon">${icon}</span>
                        <span class="guard-labels">
                            <span class="guard-label">${this._escape(r.label)}</span>
                            <span class="guard-repo">${this._escape(r.repo)}</span>
                        </span>
                        <span class="guard-state">${label}</span>
                    </div>
                    ${detail ? `<p class="guard-detail">${detail}</p>` : ''}
                    ${reglas}
                    ${sinLeer}
                </div>`;
        }).join('');

        // "Protegida" NO es "segura". Antes el panel solo gritaba si la rama
        // estaba sin proteccion, y se callaba ante el caso que de verdad importa:
        // proteccion activa que NO exige pull request, o admins que la saltean.
        const prod = results.filter(r => r.role === 'production')[0];
        const problemas = prod ? this._problemasProd(prod) : [];
        const alert = problemas.length
            ? '<p class="guard-alert">Producción: <strong>' + this._escape(problemas.join(' · ')) +
              '</strong>. Eso deja pasarpusheos a <code>main</code> sin tu OK.</p>'
            : '';

        container.innerHTML = `
            ${alert}
            <div class="guard-grid">${cards}</div>
            <p class="guard-foot">
                Datos pre-calculados por el pulso del ecosistema (data/git.json) a las ${this._escape(now)}.
                ${prod && prod.detalle
                    ? 'La configuración de <code>main</code> se lee autenticada (permiso <code>Administration: read</code>) y se refresca cada 6 h. Este bloque <strong>observa</strong>: no activa ni desactiva nada.'
                    : 'Que la rama esté <em>protegida</em> no implica que exija pull request ni que seas el único que aprueba: eso solo se lee con un token de <code>Administration: read</code>.'}
            </p>`;
    },

    _bool(v) {
        if (v === true) return 'Sí';
        if (v === false) return 'No';
        return 'sin dato';
    },

    _reglasDe(d) {
        const n = d.aprobaciones_requeridas;
        const sc = d.status_checks_requeridos;
        const filas = [
            ['Exige pull request', this._bool(d.pr_requerida)],
            ['Aprobaciones que exige', n === null || n === undefined ? '—' : String(n)],
            ['Los admins también están sujetos', this._bool(d.admins_sujetos)],
            ['Force-push a main', this._bool(d.force_push_permitido)],
            ['Borrado de main', this._bool(d.borrado_permitido)],
            ['Puede pushear', d.restricciones === 'activas' ? 'solo usuarios/equipos del repo' : 'cualquiera con escritura'],
            ['Status checks', sc === null || sc === undefined ? 'ninguno' : String(sc)],
            ['Conversaciones resueltas', this._bool(d.conversaciones_resueltas)]
        ];
        return '<ul class="guard-rules">' + filas.map(f =>
            '<li><span>' + this._escape(f[0]) + '</span><b>' + this._escape(f[1]) + '</b></li>'
        ).join('') + '</ul>';
    },

    // Devuelve los motivos concretos por que la frontera de produccion no
    // sirve. Vacio = la invariante se cumple. Cada motivo sale de un dato
    // LEIDO, no de un supuesto.
    _problemasProd(r) {
        const out = [];
        if (r.state === 'open') {
            out.push('la rama main NO tiene protección');
            return out;
        }
        if (r.state !== 'protected' || !r.detalle) return out;
        const d = r.detalle;
        if (d.pr_requerida === false) {
            out.push('está protegida pero NO exige pull request: un push directo a main pasa igual');
        }
        if (d.admins_sujetos === false) {
            out.push('los administradores pueden saltear la protección');
        }
        if (d.force_push_permitido === true) {
            out.push('permite force-push sobre main');
        }
        if (d.borrado_permitido === true) {
            out.push('permite borrar la rama main');
        }
        return out;
    },

    _humanTs(compact) {
        // '20260930T154500Z' -> 'hace X' es demasiado; lo dejo legible.
        if (!compact) return 'hora desconocida';
        return String(compact).replace('T', ' ').replace('Z', ' UTC');
    },

    _escape(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    },

    _shorten(s, n) {
        return s.length > n ? s.substring(0, n) + '…' : s;
    }
};

window.ProductionGuard = ProductionGuard;
