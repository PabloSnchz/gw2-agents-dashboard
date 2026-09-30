/**
 * js/production-guard.js
 * Watchdog de protección de producción.
 *
 * Consulta la API pública de GitHub (sin token) y lee el campo `protected`
 * de la rama main de los repos clave: producción, desarrollo y el dashboard. Es un dato real, no una constante:
 * si alguien desactiva la protección de gw2-wallet-ligero, el dashboard
 * se pone rojo en la próxima carga.
 *
 * Lo que NO se puede verificar sin token: si la regla exige pull request,
 * cuántos approvals necesita y QUIÉN aprueba. Eso hay que confirmarlo a
 * mano en Settings → Rules. El panel lo dice explícitamente para no
 * dar una falsa sensación de cobertura.
 *
 * Rate limit: 60 req/h por IP sin token. Cada carga del dashboard usa 3
 * de esos requests, así que el margen es holgado.
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
                checkedAt: r.protected_verificado_utc
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
                label = critico ? 'SIN PROTECCIÓN' : 'Abierta (esperado)';
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
                </div>`;
        }).join('');

        const prod = results.filter(r => r.role === 'production')[0];
        const alert = (prod && prod.state === 'open')
            ? '<p class="guard-alert">Producción <strong>NO</strong> está protegida. Cualquiera con permiso de escritura ' +
              'puede pushear directo a <code>main</code> sin pasar por vos. Revisá Settings → Rules.</p>'
            : '';

        container.innerHTML = `
            ${alert}
            <div class="guard-grid">${cards}</div>
            <p class="guard-foot">
                Datos pre-calculados por el pulso del ecosistema (data/git.json) a las ${this._escape(now)}.
                Que la rama esté <em>protegida</em> no implica que exija PR ni que seas el único que aprueba:
                eso <strong>no se puede leer sin token</strong>. Confirmalo en Settings → Rules.
            </p>`;
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
