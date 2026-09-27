/**
 * js/app.js
 * Orquestación del dashboard: fetch paralelo → parser KPIs → renderer estructurado.
 * KPIs + agent cards arriba, alertas/comms en 2-columnas, logs en acordeones.
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
        elements.refreshBtn.addEventListener('click', () => loadAll(true));
        elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

        // Cargar datos inmediatamente
        loadAll(true);

        // Restaurar auto-refresh si estaba activo
        if (saved === 'true') {
            autoRefreshTimer = setInterval(() => loadAll(false), config.autoRefreshInterval);
        }
    }

    // --- AUTO REFRESH ---
    function toggleAutoRefresh(e) {
        const enabled = e.target.checked;
        localStorage.setItem(config.autoRefreshKey, String(enabled));

        if (enabled) {
            autoRefreshTimer = setInterval(() => loadAll(false), config.autoRefreshInterval);
            showStatus('Auto-refresh activado (cada 5 min)', 'status-ok');
        } else {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            showStatus('Auto-refresh desactivado', 'status-warning');
        }
    }

    // --- LOAD ALL ---
    async function loadAll(force = true) {
        showStatus('Cargando...', 'status-loading');

        // Opción C' — API discovery + fallback hardcodeado
        let results;
        const detectedFiles = await fetcher.fetchFileList();
        const fetchResults = detectedFiles
            ? await fetcher.fetchAll(force, detectedFiles)
            : await fetcher.fetchAll(force);

        // Build lookup por filename para el parser
        const fileMap = {};
        fetchResults.forEach(r => { fileMap[r.filename] = r; });

        // --- Parse KPIs estructurados ---
        const kpiData = {
            agents: [],
            alerts: null,
            comms: null,
            sessions: null
        };

        // TEAM_STATUS.md → agent states + crons
        if (fileMap['TEAM_STATUS.md'] && fileMap['TEAM_STATUS.md'].success) {
            const parsed = DashboardParser.parseTeamStatus(fileMap['TEAM_STATUS.md'].content);
            if (parsed.parseable) {
                kpiData.agents = parsed.agents || [];
                kpiData.crons = parsed.crons || [];
            }
        }

        // ALERTS_LOG.md → alertas por severidad
        if (fileMap['ALERTS_LOG.md'] && fileMap['ALERTS_LOG.md'].success) {
            kpiData.alerts = DashboardParser.parseAlerts(fileMap['ALERTS_LOG.md'].content);
        }

        // COMMS_LOG.md → comunicaciones pendientes
        if (fileMap['COMMS_LOG.md'] && fileMap['COMMS_LOG.md'].success) {
            kpiData.comms = DashboardParser.parseComms(fileMap['COMMS_LOG.md'].content);
        }

        // SESSION_LOG.md → sesiones
        if (fileMap['SESSION_LOG.md'] && fileMap['SESSION_LOG.md'].success) {
            kpiData.sessions = DashboardParser.parseSessionLog(fileMap['SESSION_LOG.md'].content);
        }

        // --- Render ---
        DashboardRenderer.renderKPIs({
            agents: kpiData.agents,
            alerts: kpiData.alerts,
            comms: kpiData.comms,
            sessions: kpiData.sessions
        });

        DashboardRenderer.renderAgentCards(kpiData.agents);

        const alertsData = kpiData.alerts || { details: [], active: 0, bySeverity: {} };
        const commsData = kpiData.comms || { details: [], pending: 0, timeout: 0 };
        DashboardRenderer.renderAlertsAndComms(alertsData, commsData);

        DashboardRenderer.renderAccordions(fetchResults);

        showStatus(`Última actualización: ${new Date().toLocaleTimeString()}`, 'status-ok');
    }

    // --- STATUS BAR ---
    function showStatus(message, className) {
        elements.statusBar.textContent = message;
        elements.statusBar.className = className;
    }

    // --- RETRY ---
    window.retryLoad = function() {
        loadAll(true);
    };

    window.toggleAccordion = function(filename) {
        const body = document.getElementById('acc-' + filename);
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        localStorage.setItem('gn:dashboard:accordion:' + filename, String(isHidden));
    };

    window.retryAccordion = function(filename) {
        loadAll(true);
    };
})();
