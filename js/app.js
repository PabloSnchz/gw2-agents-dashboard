/**
 * js/app.js
 * Orquestación del dashboard: fetch paralelo → parser KPIs → renderer estructurado.
 * Tabs: Resumen / Equipo / Historial / Proximas / Estructura / Promociones / Logs.
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
    let commsFilterState = { statusFilter: 'all', importanceFilter: 'all', searchTerm: '' };

    // Estado del tab activo
    const TAB_STORAGE_KEY = 'gn:dashboard:active-tab';
    // OJO: esta lista decide que tabs funcionan. setDashboardTab hace
    // `if (!VALID_TABS.includes(tabName)) return;`, asi que un tab que no este
    // aca NO cambia: el click no hace nada y no hay error en consola. Cuando se
    // agrega un tab hay que agregarlo ACA tambien (el boton en index.html y el
    // div .dashboard-tab-content no alcanzan). Por eso 'salud' falto durante
    // tiempo: el boton existia, eco-health renderizaba perfecto, y el tab no se
    // abria nunca.
    const VALID_TABS = ['resumen', 'equipo', 'historial', 'proximas', 'promociones', 'salud', 'estructura', 'logs'];

    // ============ TABS (definido PRIMERO, antes de init) ============
    window.setDashboardTab = function(tabName, silent) {
        if (!VALID_TABS.includes(tabName)) return;

        // Guardar en localStorage
        localStorage.setItem(TAB_STORAGE_KEY, tabName);

        // Actualizar hash (si no es silencioso)
        if (!silent && location.hash !== '#' + tabName) {
            location.hash = tabName;
        }

        // Actualizar botones activos
        document.querySelectorAll('.dashboard-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Mostrar/ocultar contenidos
        document.querySelectorAll('.dashboard-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === tabName);
        });
    };

    function getActiveTab() {
        const active = document.querySelector('.dashboard-tab.active');
        return active ? active.dataset.tab : 'resumen';
    }

    // ============ INIT ============
    init();

    function init() {
        // Restaurar tab activo (desde hash o localStorage)
        const hashTab = location.hash.replace('#', '').toLowerCase();
        const savedTab = localStorage.getItem(TAB_STORAGE_KEY);
        const initialTab = VALID_TABS.includes(hashTab) ? hashTab
                          : VALID_TABS.includes(savedTab) ? savedTab
                          : 'resumen';
        setDashboardTab(initialTab, true);

        // Listener de hashchange
        window.addEventListener('hashchange', () => {
            const t = location.hash.replace('#', '').toLowerCase();
            if (VALID_TABS.includes(t) && t !== getActiveTab()) {
                setDashboardTab(t, true);
            }
        });

        // Cargar estado guardado de auto-refresh
        const saved = localStorage.getItem(config.autoRefreshKey);
        elements.autoRefreshToggle.checked = saved === 'true';

        // Event listeners
        elements.refreshBtn.addEventListener('click', () => loadAll(true));
        elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);

        // Comms filters + search
        const savedSortKey = localStorage.getItem('gn:dashboard:comms:sort:key');
        const savedSortDir = localStorage.getItem('gn:dashboard:comms:sort:dir');
        if (savedSortKey && savedSortDir) {
            commsSortState = { key: savedSortKey, direction: savedSortDir };
        }
        const savedFilterStatus = localStorage.getItem('gn:dashboard:comms:filter:status');
        if (savedFilterStatus) {
            commsFilterState.statusFilter = savedFilterStatus;
        }
        const savedFilterImportance = localStorage.getItem('gn:dashboard:comms:filter:importance');
        if (savedFilterImportance) {
            commsFilterState.importanceFilter = savedFilterImportance;
        }

        // Cargar datos inmediatamente
        loadAll(true);

        // Restaurar auto-refresh si estaba activo
        if (saved === 'true') {
            autoRefreshTimer = setInterval(() => loadAll(false), config.autoRefreshInterval);
        }
    }

    // ============ AUTO REFRESH ============
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

    // ============ LOAD ALL ============
    async function loadAll(force = true) {
        showStatus('Cargando...', 'status-loading');

        // La estructura se carga por separado y sin bloquear: si falla, el resto del


        // dashboard funciona igual y el tab Estructura lo dice.


        const estructuraPromise = fetcher.fetchEstructura().catch(e => ({ success: false, data: null, error: e.message }));


        


        const detectedFiles = await fetcher.fetchFileList();
        const fetchResults = detectedFiles
            ? await fetcher.fetchAll(force, detectedFiles)
            : await fetcher.fetchAll(force);

        const fileMap = {};
        fetchResults.forEach(r => { fileMap[r.filename] = r; });

        const kpiData = {
            agents: [],
            alerts: null,
            comms: null,
            sessions: null
        };

        if (fileMap['TEAM_STATUS.md'] && fileMap['TEAM_STATUS.md'].success) {
            const parsed = DashboardParser.parseTeamStatus(fileMap['TEAM_STATUS.md'].content);
            if (parsed.parseable) {
                kpiData.agents = parsed.agents || [];
                kpiData.crons = parsed.crons || [];
            }
        }

        if (fileMap['ALERTS_LOG.md'] && fileMap['ALERTS_LOG.md'].success) {
            kpiData.alerts = DashboardParser.parseAlerts(fileMap['ALERTS_LOG.md'].content);
        }

        if (fileMap['COMMS_LOG.md'] && fileMap['COMMS_LOG.md'].success) {
            kpiData.comms = DashboardParser.parseComms(fileMap['COMMS_LOG.md'].content);
        }

        if (fileMap['COMMS_LOG.md'] && fileMap['COMMS_LOG.md'].success) {
            kpiData.commsDetail = DashboardParser.parseCommunications(fileMap['COMMS_LOG.md'].content);
        }

        if (fileMap['SESSION_LOG.md'] && fileMap['SESSION_LOG.md'].success) {
            kpiData.sessions = DashboardParser.parseSessionLog(fileMap['SESSION_LOG.md'].content);
        }

        const commits = await fetcher.fetchCommits(50).catch(() => []);
        const estructura = await estructuraPromise;
        window._estructura = estructura.success ? estructura.data : null;

        // Render KPIs
        //
        // OJO: DashboardRenderer.renderKPIs() ya NO se llama. Escribia en
        // #kpi-grid, que dejo de existir cuando el Resumen paso a ser
        // Pulso (js/pulso.js, #pulso-kpis). Se laxo la llamada a proposito:
        // si queda, alguien reintroduce el div un dia y los KPIs vuelven
        // a pintar "AGENTES 0/0" y "COMMS 0", que son ceros falsos
        // (venian de parsear TEAM_STATUS.md, que no tiene esos datos en un
        // formato que el parser entendiera). El pulso los calcula desde
        // agent.json reales. La funcion sigue en renderer.js, sin usar.

        DashboardRenderer.renderAgentCards(kpiData.agents);

        const alertsData = kpiData.alerts || { details: [], active: 0, bySeverity: {} };
        const commsData = kpiData.comms || { details: [], pending: 0, timeout: 0 };
        DashboardRenderer.renderAlertsAndComms(alertsData, commsData);

        DashboardRenderer.renderAccordions(fetchResults);

        if (kpiData.commsDetail && kpiData.commsDetail.parseable) {
            window.commsData = kpiData.commsDetail;
            DashboardRenderer.renderCommsKPIs(kpiData.commsDetail);
            DashboardRenderer.renderCommsToolbar(commsFilterState);
            DashboardRenderer.renderCommsTable(kpiData.commsDetail, commsSortState, commsFilterState);
            attachCommsListeners();
        }

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

        DashboardAttention.render({
            alerts: kpiData.alerts,
            comms: kpiData.commsDetail,
            teamStatus: {
                agents: kpiData.agents,
                crons: kpiData.crons
            },
            backlog: fileMap['BACKLOG.md']?.success ? { content: fileMap['BACKLOG.md'].content } : null,
            sessionLog: fileMap['SESSION_LOG.md']?.success ? { content: fileMap['SESSION_LOG.md'].content } : null,
            escalations: fileMap['TEAM_STATUS.md']?.success 
                ? DashboardParser.parseEscalations(fileMap['TEAM_STATUS.md'].content) 
                : []
        });

        // Parsear CRON_SCHEDULE.md y DASHBOARD_PO_IDEAS.md
        const cronSchedule = fileMap['CRON_SCHEDULE.md']?.success
            ? DashboardParser.parseCronSchedule(fileMap['CRON_SCHEDULE.md'].content)
            : null;

        const poIdeas = fileMap['DASHBOARD_PO_IDEAS.md']?.success
            ? DashboardParser.parsePoIdeas(fileMap['DASHBOARD_PO_IDEAS.md'].content)
            : null;

        // Parsear COMMS_DETAILS.md (conversaciones completas)
        const commsDetails = fileMap['COMMS_DETAILS.md']?.success
            ? DashboardParser.parseCommsDetails(fileMap['COMMS_DETAILS.md'].content)
            : null;

        // Exponer globalmente para que renderCommsDetail lo use
        window.commsDetails = commsDetails;

        // NUEVO: parsear READY_FOR_PROMOTION.md e IN_PROGRESS.md
        const readyForPromotion = fileMap['READY_FOR_PROMOTION.md']?.success
            ? DashboardParser.parseReadyForPromotion(fileMap['READY_FOR_PROMOTION.md'].content)
            : null;

        const inProgressFile = fileMap['IN_PROGRESS.md']?.success
            ? DashboardParser.parseInProgress(fileMap['IN_PROGRESS.md'].content)
            : null;

        // Render del Panel "Próximas horas"
        DashboardUpcoming.render({
            teamStatus: {
                content: fileMap['TEAM_STATUS.md']?.success ? fileMap['TEAM_STATUS.md'].content : '',
                crons: kpiData.crons
            },
            backlog: fileMap['BACKLOG.md']?.success ? { content: fileMap['BACKLOG.md'].content } : null,
            cronSchedule: cronSchedule,
            structure: window._estructura,
            poIdeas: poIdeas,
            readyForPromotion: readyForPromotion,
            inProgress: inProgressFile
        });

        // Render del Panel "Estado en vivo"
        DashboardLiveStatus.render({
            commits: commits,
            sessionLog: fileMap['SESSION_LOG.md']?.success ? fileMap['SESSION_LOG.md'].content : '',
            alerts: kpiData.alerts,
            structure: window._estructura
        });

        // Tab Estructura: primero la realidad verificada, despues el documento del equipo.
        // El orden importa: ORG_MAP.md se mantiene a mano y describe permisos que ya
        // no existen, asi que va debajo y colapsado, no como fuente.
        DashboardRenderer.renderEstructura(window._estructura);

        // Render del tab "Estructura" (ORG_MAP.md)
        if (fileMap['ORG_MAP.md'] && fileMap['ORG_MAP.md'].success) {
            const orgParsed = DashboardParser.parseOrgMap(fileMap['ORG_MAP.md'].content);
            DashboardRenderer.renderOrgMap(orgParsed, fileMap['ORG_MAP.md'].content);
        } else {
            // El .md no llegó (404 o red): el tab muestra el motivo, no queda vacío en silencio
            const orgError = fileMap['ORG_MAP.md'] ? fileMap['ORG_MAP.md'].error : 'no encontrado';
            const orgContainer = document.getElementById('org-map-container');
            if (orgContainer) {
                orgContainer.innerHTML = `
                    <div class="org-fallback">
                        <p class="org-callout org-callout--danger">
                            No se pudo cargar <code>ORG_MAP.md</code>: ${DashboardRenderer._escape(orgError)}
                        </p>
                        <button class="btn btn-secondary btn-sm" onclick="retryLoad()">Reintentar</button>
                    </div>`;
            }
        }

        // Render del tab "Promociones" (PROMOTIONS.md)
        if (fileMap['PROMOTIONS.md'] && fileMap['PROMOTIONS.md'].success) {
            const promoParsed = DashboardParser.parsePromotions(fileMap['PROMOTIONS.md'].content);
            DashboardRenderer.renderPromotions(promoParsed, fileMap['PROMOTIONS.md'].content);
        } else {
            const promoError = fileMap['PROMOTIONS.md'] ? fileMap['PROMOTIONS.md'].error : 'no encontrado';
            const promoContainer = document.getElementById('promotions-container');
            if (promoContainer) {
                promoContainer.innerHTML = `
                    <div class="promo-fallback">
                        <p class="promo-callout promo-callout--danger">
                            No se pudo cargar <code>PROMOTIONS.md</code>: ${DashboardRenderer._escape(promoError)}
                        </p>
                        <button class="btn btn-secondary btn-sm" onclick="retryLoad()">Reintentar</button>
                    </div>`;
            }
        }

        // Watchdog de protección de producción (API pública de GitHub, sin token)
        if (window.ProductionGuard) ProductionGuard.render();

        // Canal durable entre agentes (data/comms.json). Es un fetch
        // independiente del resto: si comms.json todavia no existe, el
        // panel lo dice y el resto del dashboard sigue funcionando.
        if (window.CommsChannel) CommsChannel.load();

        // Salud del ecosistema (data/salud.json), escrita por
        // health_check.py desde el scheduler de Windows. Tamien
        // independiente: si falla, el resto del dashboard sigue.
        if (window.EcoHealth) EcoHealth.load();

        // El pulso del proyecto (js/pulso.js) lee el MISMO data/salud.json
        // que la tab Salud, pero distinto: Salud es el detalle de como
        // estan corriendo las cosas; el Resumen es donde esta el trabajo.
        // Un solo fetch, dos lecturas del mismo dato.
        //
        // Sin esta llamada, js/pulso.js se carga y no dibuja nada: el mismo
        // modo de falla que el tab 'salud' antes de que 'salud' estuviera
        // en VALID_TABS. Un panel desplegado y vacio no se distingue de uno
        // que no tiene nada.
        if (window.Pulso) Pulso.load();

        showStatus(`Última actualización: ${new Date().toLocaleTimeString()}`, 'status-ok');
    }

    // ============ STATUS BAR ============
    function showStatus(message, className) {
        elements.statusBar.textContent = message;
        elements.statusBar.className = className;
    }

    // ============ RETRY ============
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

    // ============ COMMS LISTENERS ============
    function attachCommsListeners() {
        const filterSelect = $('comms-filter-status');
        const filterImportance = $('comms-filter-importance');
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

        if (filterImportance) {
            filterImportance.addEventListener('change', (e) => {
                commsFilterState.importanceFilter = e.target.value;
                localStorage.setItem('gn:dashboard:comms:filter:importance', e.target.value);
                if (window.commsData) {
                    DashboardRenderer.renderCommsTable(window.commsData, commsSortState, commsFilterState);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                commsFilterState.searchTerm = e.target.value;
                localStorage.setItem('gn:dashboard:comms:search', e.target.value);
                if (window.commsData) {
                    DashboardRenderer.renderCommsTable(window.commsData, commsSortState, commsFilterState);
                }
            });
        }

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

    // ============ COMMS SORT ============
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
