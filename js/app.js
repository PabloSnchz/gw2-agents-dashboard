/**
 * js/app.js
 * App principal: renderiza markdown con marked.js en 3 zonas,
 * maneja auto-refresh, errores y estado actual estructurado.
 */

(() => {
    const config = DASHBOARD_CONFIG;
    const fetcher = new MarkdownFetcher(config);

    // Cache DOM
    const $ = (id) => document.getElementById(id);
    const elements = {
        refreshBtn: $('btn-refresh'),
        autoRefreshToggle: $('toggle-autorefresh'),
        statusBar: $('status-bar'),
        zones: {
            current: $('content-current'),
            recent: $('content-recent'),
            history: $('content-history'),
        }
    };

    // Estado
    let autoRefreshTimer = null;

    // --- INIT ---
    init();

    function init() {
        // Cargar estado guardado de auto-refresh
        const saved = localStorage.getItem(config.autoRefreshKey);
        elements.autoRefreshToggle.checked = saved === 'true';

        // Event listeners
        elements.refreshBtn.addEventListener('click', loadAll);
        elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

        // Cargar datos inmediatamente
        loadAll();

        // Restaurar auto-refresh si estaba activo
        if (saved === 'true') {
            autoRefreshTimer = setInterval(loadAll, config.autoRefreshInterval);
        }
    }

    // --- AUTO REFRESH ---
    function toggleAutoRefresh(e) {
        const enabled = e.target.checked;
        localStorage.setItem(config.autoRefreshKey, String(enabled));

        if (enabled) {
            autoRefreshTimer = setInterval(loadAll, config.autoRefreshInterval);
            showStatus('Auto-refresh activado (cada 5 min)', 'status-ok');
        } else {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            showStatus('Auto-refresh desactivado', 'status-warning');
        }
    }

    // --- LOAD ALL ---
    async function loadAll() {
        showStatus('Cargando...', 'status-loading');

        // Limpiar zonas
        Object.values(elements.zones).forEach(zone => zone.innerHTML = '');

        const results = await fetcher.fetchAll(true);

        // Separar por zona
        const byZone = {
            current: results.filter(r => r.zone === 'current'),
            recent: results.filter(r => r.zone === 'recent'),
            history: results.filter(r => r.zone === 'history'),
        };

        // Renderizar cada zona
        renderZoneCurrent(byZone.current);
        renderZoneFileGrid(byZone.recent, elements.zones.recent);
        renderZoneFileGrid(byZone.history, elements.zones.history);

        showStatus(`Última actualización: ${new Date().toLocaleTimeString()}`, 'status-ok');
    }

    // --- STATUS BAR ---
    function showStatus(message, className) {
        elements.statusBar.textContent = message;
        elements.statusBar.className = className;
    }

    // --- RENDER: ZONA "ESTADO ACTUAL" (top) ---
    // Parsing estructurado: extrae resúmenes clave de TEAM_STATUS, ALERTS, COMMS
    function renderZoneCurrent(files) {
        const container = elements.zones.current;

        // Card 1: Estado General del Sistema
        const statusCard = document.createElement('div');
        statusCard.className = 'file-card';
        statusCard.innerHTML = `
            <h3>📊 Estado General</h3>
            <div class="markdown-body">
                <p>Última carga: <strong>${new Date().toLocaleString()}</strong></p>
                ${renderFileOrError(files, 'TEAM_STATUS.md')}
            </div>
        `;
        container.appendChild(statusCard);

        // Card 2: Alertas
        const alertsCard = document.createElement('div');
        alertsCard.className = 'file-card';
        alertsCard.innerHTML = `
            <h3>🔴 Alertas</h3>
            <div class="markdown-body">
                ${renderFileOrError(files, 'ALERTS_LOG.md')}
            </div>
        `;
        container.appendChild(alertsCard);

        // Card 3: Comunicaciones
        const commsCard = document.createElement('div');
        commsCard.className = 'file-card';
        commsCard.innerHTML = `
            <h3>📬 Comunicaciones</h3>
            <div class="markdown-body">
                ${renderFileOrError(files, 'COMMS_LOG.md')}
            </div>
        `;
        container.appendChild(commsCard);
    }

    // --- RENDER: ZONA DE FILE GRID (recientes/historico) ---
    function renderZoneFileGrid(files, container) {
        if (!files || files.length === 0) {
            container.innerHTML = '<p class="loading">No hay archivos en esta zona.</p>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'file-card';

            if (file.success) {
                const html = marked.parse(file.content);
                card.innerHTML = `
                    <h3>
                        ${file.label}
                        <span class="status-ok">✅</span>
                    </h3>
                    <div class="markdown-body">${html}</div>
                `;
            } else {
                const is404 = file.error && file.error.includes('no encontrado');
                card.innerHTML = `
                    <h3>
                        ${file.label}
                        <span class="status-${is404 ? 'warning' : 'error'}">
                            ${is404 ? '⚠️' : '❌'}
                        </span>
                    </h3>
                    <div class="card-error">
                        ${file.error || 'Error desconocido'}
                        ${is404 ? '' : '<br><button class="btn btn-secondary btn-sm" onclick="retryLoad()">Reintentar</button>'}
                    </div>
                `;
            }

            container.appendChild(card);
        });
    }

    // --- UTIL: Renderizar archivo o error en zona de estado actual ---
    function renderFileOrError(files, filename) {
        const file = files.find(f => f.filename === filename);

        if (!file) {
            return '<p class="loading">Archivo no configurado.</p>';
        }

        if (file.error) {
            const is404 = file.error.includes('no encontrado');
            const icon = is404 ? '⚠️' : '❌';
            return `<p class="${is404 ? 'status-warning' : 'status-error'}">${icon} ${file.error}</p>`;
        }

        if (file.success && file.content) {
            // Validar markdown antes de parsear
            try {
                return marked.parse(file.content);
            } catch (e) {
                return `<div class="card-error">⚠️ Markdown parse error: ${e.message}<br><small>Renderizando raw...</small></div>
                        <pre>${file.content}</pre>`;
            }
        }

        return '<p class="loading">Cargando...</p>';
    }

    // --- RETRY ---
    window.retryLoad = function() {
        loadAll();
    };
})();
