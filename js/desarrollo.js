/**
 * js/desarrollo.js - Tab [D] Desarrollo.
 *
 * 2026-10-05. Tres containers vacios (clones / ramas / features) que
 * ningun script llenaba. Este modulo los puebla con los datos que
 * llegan por separado: data/git.json (rama activa de cada clon,
 * trabajo sin commitear), data/ramas.json (ramas vivas del repo de
 * desarrollo) y FEATURES.md (features construidas por el equipo).
 *
 * 2026-10-08. Agregados sub-headers con conteo y grid layout
 * para consistencia visual con el resto del dashboard.
 */
(function () {
    const CLONES_ID = 'desarrollo-clones';
    const RAMAS_ID = 'desarrollo-ramas';
    const FEATURES_ID = 'desarrollo-features';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
            .replace(/"/g, '"');
    }

    function subHeader(title, count) {
        return '<div class="desarrollo-subheader">'
            + '<span>' + esc(title) + '</span>'
            + '<span class="desarrollo-subheader-count">' + count + '</span>'
            + '</div>';
    }

    function cloneCard(repo) {
        const label = esc(repo.label);
        const role = esc(repo.role);
        const sha = repo.short_sha ? esc(repo.short_sha) : '---';
        const rama = repo.rama ? esc(repo.rama) : '<span class="d-unknown">sin rama</span>';
        const estado = repo.estado || 'unknown';
        const estadoClass = 'd-estado--' + estado;
        const sc = repo.sin_commitear || 0;
        const scBadge = sc > 0
            ? '<span class="d-badge d-badge--work">' + sc + ' sin commitear</span>'
            : '<span class="d-badge d-badge--clean">limpio</span>';
        const prot = repo.protected ? '<span class="d-prot">protegido</span>' : '';
        const files = (repo.archivos_modificados || []).slice(0, 5).map(a =>
            '<li>' + esc(a) + '</li>'
        ).join('');
        const more = (repo.archivos_modificados || []).length > 5
            ? '<li>... ' + ((repo.archivos_modificados || []).length - 5) + ' mas</li>'
            : '';
        const error = repo.clon_error
            ? '<div class="d-error">! ' + esc(repo.clon_error) + '</div>'
            : '';
        return '<article class="d-clone-card">'
            + '<div class="d-clone-head"><span class="d-label">' + label + '</span>'
            + '<span class="d-role">' + role + '</span></div>'
            + '<div class="d-clone-meta"><span class="d-sha">' + sha + '</span>'
            + '<span class="d-rama">rama: ' + rama + '</span>'
            + '<span class="' + estadoClass + '">' + estado + '</span>'
            + prot + '</div>'
            + '<div class="d-clone-work">' + scBadge + '</div>'
            + (files || more ? '<ul class="d-files">' + files + more + '</ul>' : '')
            + error + '</article>';
    }

    function ramaCard(r) {
        const nombre = esc(r.nombre);
        const sha = esc(r.sha);
        const autor = esc(r.autor);
        const msg = esc(r.msj);
        const edad = r.edad ? ' <span class="d-age">hace ' + r.edad + '</span>' : '';
        return '<article class="d-rama-card">'
            + '<div class="d-rama-head"><span class="d-label">' + nombre + '</span>'
            + '<span class="d-sha">' + sha + '</span></div>'
            + '<div class="d-rama-meta"><span class="d-autor">' + autor + '</span>' + edad + '</div>'
            + '<div class="d-rama-msg">' + msg + '</div></article>';
    }

    function featureCard(f) {
        const nombre = esc(f.nombre);
        const estado = esc(f.estado);
        const estadoClass = 'd-estado--' + estado;
        const sha = f.sha ? ' <span class="d-sha">' + esc(f.sha) + '</span>' : '';
        const files = (f.archivos || []).slice(0, 4).map(a =>
            '<li>' + esc(a) + '</li>'
        ).join('');
        const more = (f.archivos || []).length > 4
            ? '<li>... ' + ((f.archivos || []).length - 4) + ' mas</li>'
            : '';
        const desc = f.description ? '<div class="d-f-desc">' + esc(f.description) + '</div>' : '';
        return '<article class="d-feature-card">'
            + '<div class="d-feature-head"><span class="d-label">' + nombre + '</span>'
            + '<span class="' + estadoClass + '">' + estado + '</span>' + sha + '</div>'
            + desc
            + (files || more ? '<ul class="d-files">' + files + more + '</ul>' : '')
            + '</article>';
    }

    function empty(msg) {
        return '<p class="d-empty">' + esc(msg) + '</p>';
    }

    function renderClones(clones) {
        const c = document.getElementById(CLONES_ID);
        if (!c) return;
        if (!clones || !clones.length) {
            c.innerHTML = subHeader('Clones', 0) + empty('sin datos de clon');
            return;
        }
        c.innerHTML = subHeader('Clones', clones.length) + clones.map(cloneCard).join('');
    }

    function renderRamas(ramas) {
        const c = document.getElementById(RAMAS_ID);
        if (!c) return;
        if (!ramas || !ramas.length) {
            c.innerHTML = subHeader('Ramas vivas', 0) + empty('sin ramas vivas');
            return;
        }
        c.innerHTML = subHeader('Ramas vivas', ramas.length) + ramas.map(ramaCard).join('');
    }

    function renderFeatures(features) {
        const c = document.getElementById(FEATURES_ID);
        if (!c) return;
        if (!features || !features.length) {
            c.innerHTML = subHeader('Features', 0) + empty('sin features');
            return;
        }
        c.innerHTML = subHeader('Features', features.length) + features.map(featureCard).join('');
    }

    function load() {
        const gitData = window.__gitData || null;
        const ramasData = window.__ramasData || null;
        const featuresData = window.__featuresData || null;

        renderClones((gitData && gitData.repos) || []);

        const ramas = (ramasData && ramasData.ramas) || [];
        // Solo ramas no-PROTEGIDA: main y las que un worktree activo usa
        // son ruido para esta vista. El veredicto viene de gen_ramas.py.
        const vivas = ramas.filter(r => r.veredicto !== 'PROTEGIDA');
        renderRamas(vivas);

        const feats = (featuresData && featuresData.features) || [];
        renderFeatures(feats);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
    window.Desarrollo = { renderClones: renderClones, renderRamas: renderRamas, renderFeatures: renderFeatures, load: load };
})();