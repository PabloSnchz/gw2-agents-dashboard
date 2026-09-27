# GW2 Agents Dashboard

> 🐈 Tablero de monitoreo para el ecosistema de agentes de Bóveda del Gato Negro.

Visualiza estado de agentes, alertas, comunicaciones, backlog y propuestas en tiempo real.

## Características

- 📊 3 zonas: Estado actual (top), Últimas 24h (medio), Histórico (abajo)
- 🔄 Auto-refresh configurable (5 min, default OFF)
- ⚡ Fetch de 7 archivos .md vía GitHub raw
- 🎨 CSS 2 capas (main.css layout + theme.css skin)
- 📱 Responsive

## Arquitectura

```
gw2-agents-dashboard/
├── index.html          # Entry point
├── css/main.css        # Layout (3 zonas, grid)
├── css/theme.css       # Skin (colores, hover, glow)
├── js/config.js        # URLs de .md, zonas, preferencias
├── js/fetcher.js       # Fetch + cache + error handling
├── js/app.js           # Render con marked.js, auto-refresh
├── vendor/marked.min.js # CDN (no se commitea)
└── README.md
```

**Tech:** Vanilla JS + marked.js v4 (CDN)

## Archivos monitoreados

| Archivo | Zona | Descripción |
|---------|------|-------------|
| TEAM_STATUS.md | Estado actual | Estado del equipo + tareas |
| ALERTS_LOG.md | Estado actual | Alertas del sistema |
| COMMS_LOG.md | Estado actual | Comunicaciones entre agentes |
| SESSION_LOG.md | Últimas 24h | Log de sesión |
| BACKLOG.md | Últimas 24h | Tareas técnicas pendientes |
| DECISIONS_LOG.md | Últimas 24h | Decisiones del equipo |
| PRE_BACKLOG.md | Histórico | Propuestas del PO |

## Deploy

GitHub Pages: https://pablosnchz.github.io/gw2-agents-dashboard/
