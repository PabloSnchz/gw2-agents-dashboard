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
    autoRefreshInterval: 5 * 60 * 1000, // 5 minutos
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
        { name: 'PRE_BACKLOG.md', zone: 'history', label: 'Pre-Backlog' },
    ],

    // Genera URL raw de GitHub para un archivo
    getUrl(filename) {
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.branch}/${filename}`;
    }
};
