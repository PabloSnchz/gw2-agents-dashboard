# SESSION LOG — gw2-agents-dashboard

## [2026-09-27] Creación del Agentes Dashboard

### Qué se hizo
- ✅ Repo `gw2-agents-dashboard` creado en GitHub (PabloSnchz/gw2-agents-dashboard)
- ✅ Estructura: index.html, css/main.css + theme.css, js/config.js + fetcher.js + app.js
- ✅ Fetch de 7 archivos .md desde `PabloSnchz/gw2-wallet-agents` (raw.githubusercontent.com)
- ✅ Render con marked.js v4 (CDN, no commited)
- ✅ 3 zonas: Estado Actual (top), Últimas 24h (medio), Histórico (abajo)
- ✅ Parsing estructurado en Estado Actual (TEAM_STATUS, ALERTS, COMMS)
- ✅ File-grid en Últimas 24h y Histórico (SESSION_LOG, BACKLOG, DECISIONS, PRE_BACKLOG)
- ✅ Error handling: 404 → "Archivo no encontrado" con ⚠️, network error → retry button
- ✅ Auto-refresh toggle (5 min, default OFF, persistido en localStorage con prefijo `gn:`)
- ✅ Cache-busting `?v=2` en script tags
- ✅ CSS 2 capas: main.css (layout) + theme.css (skin)
- ✅ GitHub Pages activado: https://pablosnchz.github.io/gw2-agents-dashboard/
- ✅ Verificado en browser real: todas las zonas renderizan correctamente

### Qué se rompió
- Bug inicial: `renderFileOrError` usaba `f.name` en lugar de `f.filename` → Estado Actual mostraba "Archivo no configurado". **Fix:** cambiado a `f.filename`.
- Cache del CDN del browser: requirió `?v=2` en script tags para forzar reload.

### Qué quedó pendiente
- PRE_BACKLOG.md no existe en `gw2-wallet-agents/main/` → 404 (manejado gracefulmente).
  Se puede re-point a otro branch si el PO lo sube ahí.

### Decisiones técnicas
- marked.js v4 via CDN (no se commitea) — zero build step.
- CSS 2 capas (main.css layout + theme.css skin) — apropiado para un dashboard standalone, no aplica la regla de 3 capas de gw2-wallet-ligero.
- localStorage prefijo `gn:` para auto-refresh toggle (siguiendo convención del proyecto).
- Cache en memoria con TTL diaria en fetcher.js (evita rate limits de raw.githubusercontent.com).
