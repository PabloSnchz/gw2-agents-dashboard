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
        return Promise.all(REPOS_GUARD.map(async r => {
            const url = `https://api.github.com/repos/PabloSnchz/${r.repo}/branches/main`;
            try {
                const res = await fetch(url);
                if (res.status === 403 || res.status === 429) {
                    return Object.assign({}, r, { state: 'unknown', reason: 'rate limit de la API de GitHub' });
                }
                if (!res.ok) {
                    return Object.assign({}, r, { state: 'unknown', reason: 'API ' + res.status });
                }
                const data = await res.json();
                const commit = data.commit && data.commit.commit;
                return Object.assign({}, r, {
                    state: data.protected ? 'protected' : 'open',
                    lastSha: data.commit && data.commit.sha ? data.commit.sha.substring(0, 7) : null,
                    lastCommit: commit ? commit.message.split('\n')[0] : null
                });
            } catch (e) {
                return Object.assign({}, r, { state: 'unknown', reason: e.message });
            }
        }));
    },

    async render() {
        const container = document.getElementById('guard-container');
        if (!container) return;

        container.innerHTML = '<p class="guard-loading">Verificando protecci&oacute;n en GitHub&hellip;</p>';

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

            const detail = r.state === 'unknown'
                ? this._escape(r.reason)
                : (r.lastCommit
                    ? 'Último <code>' + this._escape(r.lastSha) + '</code> — ' + this._escape(this._shorten(r.lastCommit, 70))
                    : '');

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
                Verificado en vivo contra la API de GitHub a las ${this._escape(now)}.
                Que la rama esté <em>protegida</em> no implica que exija PR ni que seas el único que aprueba:
                eso <strong>no se puede leer sin token</strong>. Confirmalo en Settings → Rules.
            </p>`;
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
