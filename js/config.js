/**
 * js/config.js
 * Configuración del dashboard de agentes.
 * Define URLs de los .md a monitorear, zonas de render y preferencias.
 */

const DASHBOARD_CONFIG = {
    // Repo de donde se fetchuean los archivos
    repoOwner: 'PabloSnchz',
    repoName: 'gw2-wallet-agents',
    branch: 'main',

    // Config de auto-refresh
    autoRefreshInterval: 10 * 60 * 1000, // 10 minutos
    autoRefreshKey: 'gn:dashboard:auto-refresh', // prefijo gn: según convención

    // Archivos a monitorear → zona de render
    // Zone 'current' = Estado actual (top)
    // Zone 'recent'  = Últimas 24h (medio)
    // Zone 'history' = Histórico (abajo)
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
        { name: 'COMMS_DETAILS.md', zone: 'recent', label: 'Detalle de Comunicaciones' },
        { name: 'PRE_BACKLOG.md', zone: 'history', label: 'Pre-Backlog' },
    ],

    // Genera URL raw de GitHub para un archivo
    getUrl(filename) {
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.branch}/${filename}`;
    },

    // Opción C' — GitHub Contents API (primary) para auto-detectar .md
    getApiUrl() {
        return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents?ref=${this.branch}`;
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
        return 'recent'; // default: SESSION, BACKLOG, DECISIONS, y nuevos archivos
    },

    // Genera label legible a partir del nombre de archivo
    getLabelForFile(filename) {
        return filename.replace(/_/g, ' ').replace(/\.md$/i, '');
    }
};
