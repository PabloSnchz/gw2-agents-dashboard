/**
 * js/config.js
 * Configuración del dashboard de agentes.
 * Define URLs de los .md a monitorear, zonas de render y preferencias.
 */

const DASHBOARD_CONFIG = {
    // Repo de donde se fetchuean los .md del equipo (DESARROLLO)
    repoOwner: 'PabloSnchz',
    repoName: 'gw2-wallet-agents',
    branch: 'main',

    // Repo propio del dashboard, donde vive la fuente de verdad estructural.
    // OJO: este es un repo DISTINTO al de los .md. La estructura del ecosistema
    // no se fetchea de gw2-wallet-agents porque ORG_MAP.md lo mantiene el equipo
    // y puede quedar viejo. La mantiene el Arquitecto, que es director de la
    // estructura por decisión de Pablo (2026-09-30).
    structureRepoOwner: 'PabloSnchz',
    structureRepoName: 'gw2-agents-dashboard',
    structureBranch: 'main',
    structureFile: 'data/estructura.json',

    // Config de auto-refresh
    autoRefreshInterval: 10 * 60 * 1000, // 10 minutos
    autoRefreshKey: 'gn:dashboard:auto-refresh', // prefijo gn: según convención

    // Archivos a monitorear → zona de render
    // Zone 'current'   = Estado actual (top)
    // Zone 'recent'    = Últimas 24h (medio)
    // Zone 'history'   = Histórico (abajo)
    // Zone 'structure' = Mapa organizacional (tab Estructura)
    // Zone 'promotions'= Promociones a producción (tab Promociones)
    //
    // PRE_BACKLOG.md y COMMS_DETAILS.md NO estan en agents/main: viven en el
    // workspace del Product Owner. No los listamos aca para no generar un 404 en
    // cada carga. Si alguna vez se versionan, el auto-descubrimiento por API los
    // trae solo.
    files: [
        { name: 'TEAM_STATUS.md', zone: 'current', label: 'Estado del Equipo' },
        { name: 'ALERTS_LOG.md',   zone: 'current', label: 'Alertas' },
        { name: 'COMMS_LOG.md',   zone: 'current', label: 'Comunicaciones' },
        { name: 'SESSION_LOG.md', zone: 'recent',  label: 'Session Log' },
        { name: 'BACKLOG.md',      zone: 'recent',  label: 'Backlog' },
        { name: 'DECISIONS_LOG.md', zone: 'recent', label: 'Decisiones' },
        { name: 'CRON_SCHEDULE.md', zone: 'recent', label: 'Programación' },
        { name: 'DASHBOARD_PO_IDEAS.md', zone: 'recent', label: 'Ideas del PO' },
        { name: 'READY_FOR_PROMOTION.md', zone: 'recent', label: 'Listo para promover' },
        { name: 'IN_PROGRESS.md', zone: 'recent', label: 'En desarrollo' },
        { name: 'ORG_MAP.md', zone: 'structure', label: 'Mapa Organizacional' },
        { name: 'PROMOTIONS.md', zone: 'promotions', label: 'Promociones' },
    ],

    // Genera URL raw de GitHub para un archivo
    getUrl(filename) {
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.branch}/${filename}`;
    },

    // Auto-deteccion de .md: ahora lee la lista pre-calculada de git.json
    // (archivos_md), no la contents API. Mismo dato, sin cuota.
    // Antes-era: getApiUrl() -> .../contents?ref=main  (API REST, 60/h)
    getApiUrl() {
        return this.getGitDataUrl();
    },

    // Fuente de verdad de la ESTRUCTURA del ecosistema. Vive en el repo del
    // dashboard, NO en gw2-wallet-agents: la estructura es responsabilidad del
    // Arquitecto y el equipo no tiene visibilidad de los permisos reales.
    getStructureUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/${this.structureFile}`;
    },

    // Canal durable entre agentes. Vive en disco local
    // (C:\Users\psanc\.qwenpaw\_comms) y lo vuelca a este repo el
    // exportador _comms\export_dashboard.py, que corre junto a la sonda
    // cada 30 min. Por eso vive acá y no en agents: es dato del
    // Arquitecto, igual que estructura.json.
    getCommsChannelUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/data/comms.json`;
    },

    // Salud del ecosistema. La escribe _eco\health_check.py cada 30 min
    // desde el scheduler de Windows (sin LLM). Mide frescura de los
    // archivos de estado, ramas sin integrar, crons y tokens.
    getHealthUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/data/salud.json`;
    },

    // Pantallas reales de la app de DESARROLLO, medidas sobre el menu lateral
    // de gw2-dev/index.html por _eco\gen_rutas.py.
    //
    // Por que un .json generado y no el router.js leido en el navegador:
    // router.js pesa 89 KB y traerlo en cada carga para sacar 14 strings es
    // un desperdicio. Ademas la base_url sale de leer repoOwner/repoName/
    // branch de ESTE archivo, asi que si el destino del dashboard cambia, el
    // link cambia con el. Lo unico que se trae de la app son rutas REALES: si
    // el equipo no declara una ruta para un feat, el panel no inventa una.
    getRutasUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/data/rutas-dev.json`;
    },

    // Qué construyó el equipo y dónde se ve. Lo escribe _eco\gen_dev_catalogo.py
    // leyendo el js/ real de gw2-dev: qué pantallas existen, cuáles no tienen
    // entrada en el menú, qué módulos están escritos pero no cableados, y qué
    // ítems declararon PO y Principal.
    getCatalogoUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/data/dev-catalogo.json`;
    },

    // FEATURES.md vive en el repo de DESARROLLO (agents), no en el dashboard:
    // lo escribe el equipo al mergear a agents/main. Se lee crudo y lo parsea
    // js/dev-catalogo.js en el navegador, porque las fichas son texto para
    // personas y no un formato generado. Las reglas de escritura están en el
    // AGENTS.md del Principal.
    getFeaturesUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/FEATURES.md`;
    },

    // Estado de git de los 3 repos (sha, ultimo commit, proteccion de main).
    // Lo escribe _eco\git_export.py cada 15 min y publica con el pulso.
    // REEMPLAZA a las 3 llamadas branches/main que el navegador hacia contra
    // api.github.com: la API anonima son 60/hora POR IP, asi que con la cuota
    // en cero los 3 repos quedaban en 'unknown' y el guard no podia
    // distinguir "rama abierta" de "no pude preguntar". El dato llega
    // pre-calculado, y `protected` llega cacheado con TTL de 6 h porque es
    // el unico campo que la API REST sola puede dar.
    getGitDataUrl() {
        return `https://raw.githubusercontent.com/${this.structureRepoOwner}/${this.structureRepoName}/${this.structureBranch}/data/git.json`;
    },

    // Heurística de zonas para archivos descubiertos dinámicamente via API
    getZoneForFile(filename) {
        const f = filename.toUpperCase();
        if (f.startsWith('TEAM_') || f.startsWith('ALERTS') || f.startsWith('COMMS')) return 'current';
        if (f.startsWith('PRE_')) return 'history';
        if (f.startsWith('ORG_')) return 'structure';
        if (f.startsWith('PROMOTIONS')) return 'promotions';
        return 'recent'; // default: SESSION, BACKLOG, DECISIONS, y nuevos archivos
    },

    // Genera label legible a partir del nombre de archivo
    getLabelForFile(filename) {
        return filename.replace(/_/g, ' ').replace(/\.md$/i, '');
    }
};

// --------------------------------------------------- BUG QUE ESTABA OCULTO
// Los scripts clasicos (no son modulos) comparten el scope LEXICO, no el
// objeto window: un `const` de nivel superior NO queda en
// window.DASHBOARD_CONFIG.
//
// comms-channel.js:45 y eco-health.js:24 lo buscan por ahi, y ambos hacen
// `if (!cfg || !cfg.getX()) return;` SIN dibujar nada. Como el return es
// silencioso, el panel del canal de agentes llevaba dias desplegado y
// vacio: ni mensaje, ni error, ni kpis. Solo el heading del HTML.
//
// Sin esta linea, todo lo que dependa de DASHBOARD_CONFIG dibuja en
// silencio. Un panel que no avisa que fallo se lee igual que un panel
// que no tiene nada.
window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;
