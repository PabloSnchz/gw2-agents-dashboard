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

    // Estado de comunicaciones (sort + filtros, persistido con prefijo gn:)
    let commsSortState = null;
    let commsFilterState = { statusFilter: 'all', searchTerm: '' };

    // --- INIT ---
    init();

    function init() {
        // Cargar estado guardado de auto-refresh
        const saved = localStorage.getItem(config.autoRefreshKey);
        elements.autoRefreshToggle.checked = saved === 'true';

        // Event listeners
        elements.refreshBtn.addEventListener('click', () => loadAll(true));
        elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

        // Comms filters + search (restaurados después de loadAll)
        const savedSortKey = localStorage.getItem('gn:dashboard:comms:sort:key');
        const savedSortDir = localStorage.getItem('gn:dashboard:comms:sort:dir');
        if (savedSortKey && savedSortDir) {
            commsSortState = { key: savedSortKey, direction: savedSortDir };
        }
        const savedFilterStatus = localStorage.getItem('gn:dashboard:comms:filter:status');
        if (savedFilterStatus) {
            commsFilterState.statusFilter = savedFilterStatus;
        }

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

        // COMMS_LOG.md → comunicaciones pendientes (compact KPI)
        if (fileMap['COMMS_LOG.md'] && fileMap['COMMS_LOG.md'].success) {
            kpiData.comms = DashboardParser.parseComms(fileMap['COMMS_LOG.md'].content);
        }

        // COMMS_LOG.md → comunicaciones detalladas (activas + cerradas)
        if (fileMap['COMMS_LOG.md'] && fileMap['COMMS_LOG.md'].success) {
            kpiData.commsDetail = DashboardParser.parseCommunications(fileMap['COMMS_LOG.md'].content);
        }

        // SESSION_LOG.md → sesiones
        if (fileMap['SESSION_LOG.md'] && fileMap['SESSION_LOG.md'].success) {
            kpiData.sessions = DashboardParser.parseSessionLog(fileMap['SESSION_LOG.md'].content);
        }

        // Commits de GitHub (para el timeline) — fetch en paralelo, tolerante a fallos
        const commits = await fetcher.fetchCommits(50).catch(() => []);

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

        // Render comunicaciones detalladas (KPIs + toolbar + tabla)
        if (kpiData.commsDetail && kpiData.commsDetail.parseable) {
            window.commsData = kpiData.commsDetail;
            DashboardRenderer.renderCommsKPIs(kpiData.commsDetail);
            DashboardRenderer.renderCommsToolbar(commsFilterState);
            DashboardRenderer.renderCommsTable(kpiData.commsDetail, commsSortState, commsFilterState);
            attachCommsListeners();
        }

        // Render del Timeline (Mientras no estabas)
        if (fileMap['SESSION_LOG.md'] && fileMap['SESSION_LOG.md'].success) {
            window._timelineData = {
                sessionLog: fileMap['SESSION_LOG.md'].content,
                commits: commits
            };
            DashboardTimeline.render(
                fileMap['SESSION_LOG.md'].content,
                commits,
                window.timelineState || { range: '8h', agentFilter: 'all' }
            );
        }

        // Render del Panel "Requiere tu atención"
        DashboardAttention.render({
            alerts: kpiData.alerts,
            comms: kpiData.commsDetail,
            teamStatus: {
                agents: kpiData.agents,
                crons: kpiData.crons
            },
            backlog: fileMap['BACKLOG.md']?.success ? { content: fileMap['BACKLOG.md'].content } : null,
            sessionLog: fileMap['SESSION_LOG.md']?.success ? { content: fileMap['SESSION_LOG.md'].content } : null
        });

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

    // --- COMMS LISTENERS ---
    function attachCommsListeners() {
        const filterSelect = $('comms-filter-status');
        const searchInput = $('comms-search');

        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                commsFilterState.statusFilter = e.target.value;
                localStorage.setItem('gn:dashboard:comms:filter:status', e.target.value);
                if (window.commsData) {
                    DashboardRenderer.renderCommsTable(window.commsData, commsSortState, commsFilterState);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                commsFilterState.searchTerm = e.target.value;
                localStorage.setItem('gn:dashboard:comms:search', e.target.value);
                // Debounce simple: no re-render on cada tecla si es muy rápido
                if (window.commsData) {
                    DashboardRenderer.renderCommsTable(window.commsData, commsSortState, commsFilterState);
                }
            });
        }

        // Close modal: outside click + Escape
        const modal = $('comms-detail-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closeCommsModal();
            });
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') window.closeCommsModal();
            });
        }
    }

    // --- COMMS SORT (global para onclick en table headers) ---
    window.applyCommsSort = function(key) {
        if (!window.commsData) return;
        if (commsSortState && commsSortState.key === key) {
            commsSortState.direction = commsSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            commsSortState = { key, direction: 'asc' };
        }
        localStorage.setItem('gn:dashboard:comms:sort:key', key);
        localStorage.setItem('gn:dashboard:comms:sort:dir', commsSortState.direction);
        DashboardRenderer.renderCommsTable(window.commsData, commsSortState, commsFilterState);
    };
})();
