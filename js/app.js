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

    // Estado de las tabs: ORDEN (array) + activa (string). 2026-10-05.
    // Antes era solo el tab activo, un escalar. Eso no permitia reordenar:
    // si Pablo queria Consultas primero, habia que hardcodearlo en VALID_TABS.
    // Ahora el orden es un array guardado, y arrastrar los botones lo
    // modifica. Dos keys separados: el :v2 guardaba solo el tab activo, un
    // string, y lo usaba tanto para la tab activa como para el orden, lo que
    // era confuso. El orden es un array; la tab activa, un string.
    const TAB_ORDER_STORAGE_KEY = 'gn:dashboard:tab-order:v3';
    const TAB_ACTIVE_STORAGE_KEY = 'gn:dashboard:active-tab:v3';
    // OJO: esta lista decide que tabs funcionan. setDashboardTab hace
    // `if (!VALID_TABS.includes(tabName)) return;`, asi que un tab que no este
    // aca NO cambia: el click no hace nada y no hay error en consola. Cuando se
    // agrega un tab hay que agregarlo ACA tambien (el boton en index.html y el
    // div .dashboard-tab-content no alcanzan). Por eso 'salud' falto durante
    // tiempo: el boton existia, eco-health renderizaba perfecto, y el tab no se
    // abria nunca.
    // 2026-10-04: 'consultas' es el tab donde YO le pregunto a Pablo, ya
      // filtrado. El equipo escribe su parte cruda en CONSULTAS.md; lo que
      // llega aca es lo que yo subi. Ojo con el aviso de arriba: si esta
      // entrada falta, el boton no hace nada y no hay error en consola.
      const VALID_TABS = ['resumen', 'prebacklog', 'backlog', 'desarrollo', 'promociones', 'consultas', 'salud', 'estructura', 'equipo', 'historial', 'notas'];

    // Orden persistido de las tabs, o el default si no hay nada guardado.
    // Se lee una sola vez al init y se escribe cada vez que cambia el orden.
    let tabOrder = null;

    function loadTabOrder() {
        try {
            const raw = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length === VALID_TABS.length
                    && VALID_TABS.every(t => parsed.includes(t))) {
                    tabOrder = parsed;
                    return;
                }
            }
        } catch (e) { /* corrupto: cae al default */ }
        tabOrder = VALID_TABS.slice();
    }

    function saveTabOrder() {
        try {
            localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(tabOrder));
        } catch (e) { /* storage lleno o desactivado: sin efecto, no rompe */ }
    }

    // Reordena el DOM de los botones segun tabOrder, sin tocar el estado
    // de la tab activa. Se llama despues de loadTabOrder() y cada vez que
    // termina un drop. Los contenidos .dashboard-tab-content no se
    // reordenan: se buscan por data-tab-content, asi que el orden de los
    // botones es el unico que importa.
    function applyTabOrder() {
        const row = document.querySelector('.dashboard-tab-row');
        if (!row || !tabOrder) return;
        const btns = Array.from(row.querySelectorAll('.dashboard-tab'));
        const byTab = {};
        btns.forEach(b => { byTab[b.dataset.tab] = b; });
        const hint = row.querySelector('.dashboard-tab-drag-hint');
        row.innerHTML = '';
        if (hint) row.appendChild(hint);
        tabOrder.forEach(t => {
            const b = byTab[t];
            if (b) row.appendChild(b);
        });
    }

    // Drag and drop entre botones de la barra de tabs.
    // Cada botón lleva sus propios handlers de dragstart/dragover/drop, y el
    // contenedor .dashboard-tab-row es el unico target de drop. Asi un drop
    // que cae fuera del row no se pierde en el body: el row es el contenedor
    // logico de la barra.
    //
    // 2026-10-05. Pablo: 'las tabs del dashboard deberian ser tipo drag and
    // drop, que las pueda arrastrar y reordenar como me quiera'.
    window.startTabDrag = function(e) {
        const btn = e.currentTarget;
        e.dataTransfer.setData('text/plain', btn.dataset.tab);
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('dashboard-tab-dragging');
    };

    window.allowTabDrop = function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const row = e.currentTarget.closest('.dashboard-tab-row');
        if (row) row.classList.add('dashboard-tab-row-drag-over');
    };

    window.dropTab = function(e) {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        const to = e.currentTarget.dataset.tab;
        const row = e.currentTarget.closest('.dashboard-tab-row');
        if (row) row.classList.remove('dashboard-tab-row-drag-over');
        if (!from || !to || from === to) return;
        if (!tabOrder) loadTabOrder();
        const i = tabOrder.indexOf(from);
        const j = tabOrder.indexOf(to);
        if (i === -1 || j === -1) return;
        // splice(i,1) desplaza los índices posteriores: si i < j, el nuevo
        // índice de `to` es j-1. Sin este ajuste, arrastrar un botón hacia
        // la derecha lo dejaba un puesto más abajo del previsto. Medido en
        // tests/tab-drag-reorder.test.js: sin ajuste, 'consultas' sobre
        // 'equipo' quedaba en la posición de 'equipo', no antes.
        const item = tabOrder[i];
        tabOrder.splice(i, 1);
        const insertAt = i < j ? j - 1 : j;
        tabOrder.splice(insertAt, 0, item);
        saveTabOrder();
        applyTabOrder();
        // Mantener la tab activa visible despues del reorden.
        const active = getActiveTab();
        if (active) {
            document.querySelectorAll('.dashboard-tab-content').forEach(c => {
                c.classList.toggle('active', c.dataset.tabContent === active);
            });
        }
    };

    // ============ TABS (definido PRIMERO, antes de init) ============
    window.setDashboardTab = function(tabName, silent) {
        if (!VALID_TABS.includes(tabName)) return;

        // Guardar en localStorage
        localStorage.setItem(TAB_ACTIVE_STORAGE_KEY, tabName);

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
        return active ? active.dataset.tab : 'consultas';
    }

    // Ruta del hash, tolerante a las dos formas que existen en la practica.
    //
    // El bug, medido 2026-10-05: abrir el dashboard con #/consultas NO abria la
    // tab. Motivo exacto: se hacia location.hash.replace('#','')
    // -> '/consultas', que no esta en VALID_TABS, asi que initialTab caia al
    // localStorage y se abria otra tab. El render igual escribia el DOM, pero
    // dentro del panel oculto: #consultas-container existia con todo su
    // contenido y visible=false. Por eso el boton 'Copiar para responder' se
    // media como roto por tres vias distintas cuando jamas se habia mostrado.
    //
    // setDashboardTab escribe '#' + tabName (sin barra), asi que la forma que
    // el propio dashboard genera es '#consultas'. La forma que se copia de la
    // barra de direcciones de cualquier otra pagina es '#/consultas'. Se
    // aceptan las dos en vez de elegir una: un link compartido que abre la
    // pagina con la tab cerrada no se distingue de un link roto.
    function _tabDelHash() {
        return (location.hash || '')
            .replace(/^#\/?/, '')
            .split('?')[0]
            .trim()
            .toLowerCase();
    }

    // ============ MODO AUTOMÁTICO (switch global, cabecera) ============
    // ON = heartbeats corren, el equipo trabaja solo.
    // OFF = nada corre. Solo lo que vos apretás en cada tab.
    // El estado se guarda en localStorage con prefijo gn: para que
    // sobreviva al refresco del navegador.
    //
    // 2026-10-05. Este bloque VA ANTES de init(), no después. La primera
    // versión lo tenía al final del IIFE y `init()` llamaba a
    // `window.loadAutoMode()` en su línea 203, pero como `init()` se
    // ejecuta al instante (línea 198) y la función se definía en la
    // línea 682, el motor encontró `undefined` y tiró
    // `TypeError: window.loadAutoMode is not a function`. Eso cortó
    // `init()` allá mismo, antes de que `loadAll(true)` pudiera
    // dispararse, y el panel entero quedó vacío con un error en la
    // barra de estado. La definición tiene que estar antes de la
    // llamada, no después. No es un problema de hoisting: son
    // `function expression` asignadas a `window.X`, que no se
    // elevan.
    const AUTO_MODE_KEY = 'gn:dashboard:auto-mode';
    let autoModeOn = false;

    window.loadAutoMode = function() {
        try {
            autoModeOn = localStorage.getItem(AUTO_MODE_KEY) === 'true';
        } catch (e) { autoModeOn = false; }
        window.updateAutoModeUI();
    };

    window.saveAutoMode = function(on) {
        autoModeOn = on;
        try { localStorage.setItem(AUTO_MODE_KEY, String(on)); } catch (e) {}
        window.updateAutoModeUI();
    };

    window.updateAutoModeUI = function() {
        const btn = document.getElementById('btn-auto-mode');
        const detail = document.getElementById('auto-mode-detail');
        if (!btn) return;
        if (autoModeOn) {
            btn.textContent = 'ON';
            btn.className = 'btn btn-auto-on';
            if (detail) detail.textContent = 'Los heartbeats corren. El equipo trabaja solo.';
        } else {
            btn.textContent = 'OFF';
            btn.className = 'btn btn-auto-off';
            if (detail) detail.textContent = 'Nada corre solo. Los botones de cada tab estan habilitados.';
        }
    };

    window.toggleAutoMode = function() {
        const next = !autoModeOn;
        window.saveAutoMode(next);
        showStatus(next ? 'Modo automático ON' : 'Modo automático OFF', 'status-ok');
    };

    // ============ INIT ============
    init();

    function init() {
        // Cargar el estado del switch global ANTES de loadAll
        // para que el botón muestre ON/OFF correcto desde el primer render.
        window.loadAutoMode();
        // Orden de las tabs (nuevo modelo 2026-10-05). Se carga ANTES de
        // setDashboardTab porque el reorden del DOM depende de el.
        loadTabOrder();
        applyTabOrder();

        // Migrar storage legacy: el key :v2 guardaba solo el tab activo, un
        // string, y lo usaba tanto para la tab activa como para el orden, lo
        // que era confuso. Ahora son dos keys separados. Si lo hay, lo uso como
        // punto de partida para la tab activa y lo elimino para que no se
        // quede como ruido. No es un reorden: el array se inicializa con
        // VALID_TABS y la tab activa se conserva en el storage key nuevo.
        const legacyActive = localStorage.getItem('gn:dashboard:active-tab:v2');
        if (legacyActive && VALID_TABS.includes(legacyActive)) {
            localStorage.setItem(TAB_ACTIVE_STORAGE_KEY, legacyActive);
            try { localStorage.removeItem('gn:dashboard:active-tab:v2'); } catch (e) {}
        }

        // Restaurar tab activo (desde hash o localStorage)
        const hashTab = _tabDelHash();
        const savedTab = localStorage.getItem(TAB_ACTIVE_STORAGE_KEY);
        const initialTab = VALID_TABS.includes(hashTab) ? hashTab
                          : VALID_TABS.includes(savedTab) ? savedTab
                          : 'consultas';
        setDashboardTab(initialTab, true);

          // Consultas del Arquitecto: carga independiente de los .md, asi que
          // no espera a que termine el parseo de PROMOTIONS.md. Se dispara
          // siempre (no solo si la tab activa es esta) para que el primer click
          // ya muestre el dato y no un spinner.
          if (window.ConsultasArq) {
              window.ConsultasArq.load();
          } else {
              // Sin el modulo, la tab no queda en blanco: escribe el motivo en
              // su propio container. Un tab muda es indistinguible de "no hay
              // consultas", que es justo la confusion que esta tab evita.
              const cc = document.getElementById('consultas-container');
              if (cc) {
                  cc.innerHTML = '<div class="consultas-error">'
                      + 'No se cargo js/consultas.js.'
                      + '<span class="consultas-error__detalle">'
                      + 'El script falta en index.html o el navegador sirvio una version vieja (cache).</span></div>';
              }
          }

        // Listener de hashchange
        window.addEventListener('hashchange', () => {
            const t = _tabDelHash();
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

        // NUEVO 2026-10-05: tabs Pre-backlog, Backlog y Desarrollo.
        // Antes los containers existian en index.html pero ningún
        // script los llenaba: cajas vacias con botones que no hacia
        // nada. Ahora se parsean los .md y se llaman a los modulos.
        const preBacklogFile = fileMap['PRE_BACKLOG.md']?.success
            ? DashboardParser.parsePreBacklog(fileMap['PRE_BACKLOG.md'].content)
            : null;
        if (preBacklogFile) {
            window.__prebacklogIdeas = preBacklogFile.ideas || [];
            if (window.Prebacklog) window.Prebacklog.load();
        }

        const backlogFile = fileMap['BACKLOG.md']?.success
            ? DashboardParser.parseBacklog(fileMap['BACKLOG.md'].content)
            : null;
        if (backlogFile) {
            window.__backlogTareas = backlogFile.tareas || [];
            if (window.Backlog) window.Backlog.load();
        }

        // Desarrollo lee data/git.json (rama activa, trabajo sin
        // commitear, commits recientes), data/ramas.json y FEATURES.md.
        // Los tres son fetches independientes: git.json lo escribe
        // git_export.py cada pulso, ramas.json lo genera gen_ramas.py
        // con `git for-each-ref` + los 4 checks del wt.js, y FEATURES.md
        // lo escribe el equipo al mergear a agents/main. Ninguno es un
        // .md del equipo, así que no entran en fetchAll. Si falla, la tab
        // lo dice en lugar de quedarse vacía en silencio.
        const gitPromise = fetcher.fetchGitData().catch(e => ({ success: false, data: null, error: e.message }));
        const ramasPromise = fetcher.fetchRamas().catch(e => ({ success: false, data: null, error: e.message }));
        const featuresPromise = fetcher.fetchFeatures().catch(e => ({ success: false, content: null, error: e.message }));
        Promise.all([gitPromise, ramasPromise, featuresPromise]).then(([git, ramas, features]) => {
            window.__gitData = git.success ? git.data : null;
            window.__gitError = git.success ? null : (git.error || 'sin datos');
            window.__ramasData = ramas.success ? ramas.data : null;
            window.__ramasError = ramas.success ? null : (ramas.error || 'sin datos');
            if (features.success) {
                const parsed = DashboardParser.parseFeatures(features.content);
                window.__featuresData = parsed;
            } else {
                window.__featuresData = { parseable: false, features: [], error: features.error };
            }
            if (window.Desarrollo) window.Desarrollo.load();
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
        //
        // NO se dibuja acá: el render necesita también la lista de pantallas
        // reales de la app de dev (data/rutas-dev.json) para poder armar los
        // links y marcar como inválidas las rutas que no existen. Se deja el
        // datoParsed a mano y lo dibuja js/rutas-dev.js cuando su fetch
        // termina, pase o falle. Dibujar dos veces haría parpadear la tab,
        // y dibujar antes de tener las rutas mostraría links sin validar.
        if (fileMap['PROMOTIONS.md'] && fileMap['PROMOTIONS.md'].success) {
            window.__promoParsed = DashboardParser.parsePromotions(fileMap['PROMOTIONS.md'].content);
            window.__promoMd = fileMap['PROMOTIONS.md'].content;
            if (window.RutasDev) {
                window.RutasDev.load();
            } else {
                // Sin el módulo, la tab no queda en blanco: se dibuja sin links
                // profundos y el render avisa que no pudo validar rutas.
                DashboardRenderer.renderPromotions(window.__promoParsed, window.__promoMd,
                    null, 'no se cargó js/rutas-dev.js');
            }
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
