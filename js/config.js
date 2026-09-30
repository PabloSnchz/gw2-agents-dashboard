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

    // Opción C' — GitHub Contents API (primary) para auto-detectar .md
    getApiUrl() {
        return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents?ref=${this.branch}`;
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

    // GitHub Commits API — para el timeline
    getCommitsUrl(limit = 50) {
        return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/commits?sha=${this.branch}&per_page=${limit}`;
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
