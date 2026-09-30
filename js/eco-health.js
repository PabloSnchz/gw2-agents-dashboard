/**
 * js/eco-health.js
 * Tab "Salud" — el pulso del ecosistema, medido, no supuesto.
 *
 * Todo lo que hay aca viene de data/salud.json, que escribe
 * C:\Users\psanc\.qwenpaw\_eco\health_check.py desde el scheduler de
 * Windows cada 30 min. Determinista: no hay ningun LLM mas alla de
 * escribir el numero. Por eso el panel jamas se queda viejo, y por eso
 * el chequeo no cuesta tokens.
 *
 * Que mira:
 *   - frescura de los archivos de estado (los escribe el equipo, en teoria
 *     cada 30 min; si uno envejece, ese heartbeat no esta corriendo)
 *   - ramas con commits que main no tiene (trabajo que se pierde en silencio)
 *   - crons activos y worktrees bien anclados
 *   - tokens por agente, y cuanto se sirve del cache
 *   - frescura de los datos del propio dashboard
 */

const EcoHealth = {
    data: null,

    async load() {
        const cfg = window.DASHBOARD_CONFIG;
        if (!cfg || !cfg.getHealthUrl) return;
        try {
            const res = await fetch(cfg.getHealthUrl() + '?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = await res.json();
        } catch (e) {
            this.data = null;
            this._error = e.message;
        }
        this.render();
    },

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    // un semaforo honesto: verde si esta bien, ambar si hay que mirarlo
    _semaforo(ok, raro) {
        return ok ? 'routine' : (raro ? 'important' : 'critical');
    },

    render() {
        this._renderEstado();
        this._renderArchivos();
        this._renderRamas();
        this._renderCrons();
        this._renderTokens();
    },

    _renderEstado() {
        const c = document.getElementById('eco-salud-estado');
        if (!c) return;
        if (!this.data) {
            c.innerHTML = '<p class="cc-meta cc-meta--warn">Sin datos: ' +
                this._esc(this._error || 'no se pudo leer data/salud.json') +
                ' &mdash; el chequeo corre cada 30 min.</p>';
            return;
        }
        const d = this.data;
        const st = d.archivos_estado || [];
        const malos = st.filter(x => x.estado !== 'ok').length;

        c.innerHTML = '<p class="org-source">Medido el <strong>' +
            this._esc(d.generado_h) + '</strong> por <code>health_check.py</code>, ' +
            'sin gastar un solo token. ' +
            (malos === 0
                ? 'Los 6 archivos de estado se estan refrescando.'
                : '<strong>' + malos + ' archivo(s) de estado sin refrescar.</strong>') +
            '</p>';
    },

    _renderArchivos() {
        const c = document.getElementById('eco-archivos');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }
        const st = this.data.archivos_estado || [];
        c.innerHTML = st.map(s => {
            const v = this._semaforo(s.estado === 'ok', s.estado === 'RARO');
            const icon = s.estado === 'ok' ? '🟢' : (s.estado === 'RARO' ? '🟡' : '🔴');
            return '<tr><td>' + icon + ' <strong>' + this._esc(s.archivo) + '</strong></td>' +
                '<td>' + this._esc(s.quien) + '</td>' +
                '<td>' + (s.edad_h != null ? s.edad_h + ' h' : '—') + '</td>' +
                '<td>' + (s.kb != null ? s.kb + ' KB' : '—') +
                    (s.crecimiento ? ' <span class="cc-meta--warn">' +
                        this._esc(s.crecimiento) + '</span>' : '') + '</td></tr>';
        }).join('');
    },

    _renderRamas() {
        const c = document.getElementById('eco-ramas');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }
        const r = this.data.ramas_sin_integrar || [];
        if (!r.length) {
            c.innerHTML = '<p class="cc-empty">Todo lo que se trabajo esta integrado en main. ' +
                'Nada colgando.</p>';
            return;
        }
        c.innerHTML = '<p class="org-source">Estas ramas tienen commits que <code>main</code> ' +
            'no tiene. No estan rotas: estan <em>decidiendo</em>. Nadie las.mergeo todavia.</p>' +
            r.map(x => '<div class="comm-card cc-card">' +
                '<div class="cc-subject">' + this._esc(x.rama) + '</div>' +
                '<div class="comm-card__meta">' + x.commits + ' commit(s) sin integrar' +
                    (x.fecha ? ' &middot; ' + this._esc(x.fecha) : '') + '</div></div>').join('');
    },

    _renderCrons() {
        const c = document.getElementById('eco-crons');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }
        const cr = this.data.crons || [];
        const wt = this.data.worktrees || [];
        c.innerHTML = '<table class="comms-table"><thead><tr>' +
            '<th>Cron</th><th>Agenda</th><th>Workspace</th><th>Estado</th></tr></thead><tbody>' +
            cr.map(x => '<tr><td>' + this._esc(x.nombre) + '</td>' +
                '<td><code>' + this._esc(x.cron) + '</code></td>' +
                '<td>' + this._esc(x.workspace) + '</td>' +
                '<td>' + (x.enabled
                    ? '<span class="est-badge est-badge--ok">activo</span>'
                    : '<span class="est-badge est-badge--neutral">pausado</span>') +
                '</td></tr>').join('') +
            '</tbody></table>' +
            (wt.length
                ? '<p class="org-source" style="margin-top:10px">Worktrees: ' +
                  wt.map(w => this._esc(w.path) + ' ' +
                    (w.ok ? '<span class="est-badge est-badge--ok">anclado a gw2-dev</span>'
                          : '<span class="est-badge est-badge--danger">' + this._esc(w.ancla) +
                            '</span>')).join(' &middot; ') + '</p>'
                : '');
    },

    _renderTokens() {
        const c = document.getElementById('eco-tokens');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }
        const t = this.data.tokens || [];
        if (!t.length) { c.innerHTML = '<p class="cc-empty">Sin datos de tokens.</p>'; return; }

        c.innerHTML = t.slice().reverse().map(d => {
            const filas = (d.por_agente || []).map(a => '<tr>' +
                '<td>' + this._esc(a.agente) + '</td>' +
                '<td>' + '{:,}'.format(a.llamadas) + '</td>' +
                '<td>' + '{:,}'.format(a.prompt) + '</td>' +
                '<td>' + a.cache_pct + '%</td></tr>').join('');
            return '<div class="comms-group comms-group--unclassified">' +
                '<div class="comms-group__header">' +
                    '<span class="comms-group__label">' + this._esc(d.dia) + '</span>' +
                    '<span class="comms-group__count">' +
                        '{:,}'.format(d.llamadas) + ' llamadas &middot; cache ' +
                        d.cache_pct + '%</span>' +
                '</div>' +
                '<p class="org-source">Prompt promedio por llamada: <strong>' +
                    '{:,}'.format(d.prompt_por_llamada) + '</strong> tokens. ' +
                    'Si esto sube, las sesiones se estan alargando: ahi esta el gasto, ' +
                    'no en los archivos.</p>' +
                '<table class="comms-table"><thead><tr><th>Agente</th>' +
                    '<th>Llamadas</th><th>Prompt</th><th>Cache</th></tr></thead>' +
                    '<tbody>' + filas + '</tbody></table></div>';
        }).join('');
    }
};

window.EcoHealth = EcoHealth;
