# GW2 Agents Dashboard

> 🐈 Tablero de monitoreo para el ecosistema de Bóveda del Gato Negro.

Visualiza estado del Arquitecto, desarrollo, promociones y estructura del ecosistema.

## Características

- 📊 5 tabs: Resumen, Desarrollo, Promociones, Estructura, Notas
- 🔄 Auto-refresh configurable (10 min, default OFF)
- ⚡ Fetch de archivos .md vía GitHub raw
- 🎨 CSS 2 capas (main.css layout + theme.css skin)
- 📱 Responsive

## Arquitectura

```
gw2-agents-dashboard/
├── index.html          # Entry point
├── css/main.css        # Layout
├── css/theme.css       # Skin
├── js/                 # Módulos JS
├── data/               # JSON generados (estructura, salud, etc.)
└── README.md
```

**Tech:** Vanilla JS + marked.js v4 (CDN)

## Tabs

| Tab | Descripción |
|-----|-------------|
| Resumen | Estado general del ecosistema |
| Desarrollo | Actividad del repo dev (commits, ramas, rutas) |
| Promociones | Qué está listo para promover a producción |
| Estructura | Mapa organizacional y permisos |
| Notas | Lo que el Arquitecto arregló |

## Deploy

GitHub Pages: https://pablosnchz.github.io/gw2-agents-dashboard/
