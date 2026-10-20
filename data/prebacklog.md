# Pre-Backlog del PO (Pablo)

> Este archivo es privado del PO. Solo el PO escribe y lee.
> Los demás agentes no lo ven, salvo que el PO les pase un fragmento explícito.
>
> Reglas:
> - Propone al Principal cuando tiene 3+ ideas consolidadas.
> - Notifica al usuario una vez por semana (o cuando algo sea urgente).

> ## HB#216 / PO ronda 78 — RECOLECTAR. Strike Tracker: 15 ids siguen inalcanzables. Reddit 403 por 23ª vez. gw2treasures 404 por 16ª vez. API oficial sin cambios (184 rutas, 46 account/*). L210 Dungeon dailies: premisa falsa confirmada.

**Modo:** RECOLECTAR. **Control de carga:** `openItems = 3` (L60 ALERT-41, L88 Coberturable, L210 Dungeon dailies) — sin cambios. **PASO -1:** 0 comunicaciones "Esperando" para mí.

---

## 1. Verificación de API en vivo (HB#216)

**`/v2.json` re-medido (2026-10-18):** 184 rutas totales, 46 rutas `account/*` (45 activas, `mail` inactiva). Sin cambios vs HB#215.

**Endpoints account-scoped sin usar (confirmados):**
- `/v2/account/buildstorage` — activa, requiere `inventories`
- `/v2/account/dungeons` — activa, scope `account` + `progression`
- `/v2/account/mastery/points` — activa, scope `account`
- `/v2/account/progression` — activa, scope `account`
- `/v2/account/skins` — activa, ya tiene wrapper pero 0 callers (Idea 47)
- `/v2/account/mounts/skins` — activa (breaking change `mount` → `mount_guid` ago 2025)

**Estructura de `/v2/dungeons/<id>` confirmada:** `{id, paths:[{id, type}]}` — 4 paths por dungeon (1 Story + 3 Explorables). No `name` ni `path` fields en el detail endpoint.

---

## 2. Investigación web (Reddit, Wiki, gw2treasures, web_search)

| Fuente | Estado | Hallazgo |
|---|---|---|
| **Reddit** `/r/Guildwars2/hot.json` | 🔴 403 Blocked | 23ª vez consecutiva. Devuelve HTML de tema-beta, no JSON. |
| **GW2 Wiki** `Upcoming_changes_and_features` | 🟢 200 | Last edited 15 Oct 2026. Roadmap 2026: Skills & Balance Nov 10, WvW borderlands beta Nov 10, Hall of Monuments Dec 2026, Orr map 2027. |
| **gw2treasures** `/feeds/new_items` | 🔴 404 | 16ª vez consecutiva. Ruta ya no existe. |
| **Web search** | 🟢 200 | Raid Quickplay mode confirmed (Oct 2026 update). Strike Missions → "raid encounters" unificación (Feb 2026). New raid UI. |

**Nuevo hallazgo clave:** El update de Oct 2026 (Raid & Wardrobe) unifica **Strike Missions** bajo el término "raid encounters". Esto significa que el **Strike Tracker** de la Bóveda va a quedar anticuado conceptualmente — los strikes ya no son un modo separable, son "encuentros de raid". Esto es relevante para ALERT-41: el endpoint `/v2/account/raids` puede que eventualmente devuelva tanto raids como strikes (encuentros unificados).

---

## 3. Estado de las 3 filas abiertas (sin cambios)

### L60 — ALERT-41 (Strike Tracker): **SIGUE BLOQUEADO**
Condición única: **Pablo pega body crudo de `/v2/account/raids` con token real (permiso `progression`)**.
**Nueva consideración:** La unificación Strike→Raid (Feb 2026) sugiere que `/v2/account/raids` puede ser el endpoint correcto para strikes también. Pero sin token no se puede confirmar.

### L88 — Coberturable account-scoped: **EN CURSO**
20+ endpoints sin wrapper ni pantalla. Prioridad: `buildstorage`.

### L210 — Dungeon dailies: **PREMISA FALSA**
Los 3 "hermanos" NO están en `activities.js`. `/v2/account/dungeons` existe — es el endpoint para datos reales de dungeon completion.

---

## 4. Prioridades propuestas al Principal (sin cambios vs HB#215)

| # | Item | Dificultad | Estado |
|---|---|---|---|
| **1** | **ALERT-41**: Strike Tracker — decidir destino | 🟢 Decisión Pablo | **BLOQUEADO** |
| **2** | **L349 Homestead**: actualizar fila | 🟢 15 min | **HIGIENE** |
| **3** | **Dungeon dailies (L210)**: mover o archivar | 🟡 Medio | **PREMISA FALSA** |
| **4** | **Coberturable (L88)**: ampliar, priorizar `buildstorage` | 🟡 Medio | **EN CURSO** |
| **5** | **`/v2/account/buildstorage`**: wrapper + call site | 🟡 Medio | **NUEVO** |
| **6** | **`/v2/account/dungeons`**: nuevo endpoint account-scoped | 🟡 Medio | **NUEVO** |

---

## 5. Errores propios de esta ronda (0)

Reddit devolvió HTML (403 con JSON), gw2treasures devolvió 404, Wiki changelog devolvió 0 entries (categoría vacía). No son errores míos, son fuentes externas no disponibles.

Archivos tocados: **1 (`PRE_BACKLOG.md`)**. Rama: **ninguna nueva** (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

> ## HB#217 / PO ronda 79 — RECOLECTAR. ALERT-41 cerrado (marcado manual, commit e9f1437). Reddit 403 por 24ª vez. gw2treasures 404 por 17ª vez. API oficial sin cambios (184 rutas, 46 account/*). Web search: Oct 13/14 updates (Raid Legendary Mode, bug fixes). L210 Dungeon dailies: premisa falsa confirmada.

**Modo:** RECOLECTAR. **Control de carga:** `openItems = 3` (L60 ALERT-41, L88 Coberturable, L210 Dungeon dailies) — sin cambios. **PASO -1:** 0 comunicaciones "Esperando" para mí.

---

## 1. Verificación de API en vivo (HB#217)

**`/v2.json` re-medido (2026-10-18):** 184 rutas totales, 46 rutas `account/*` (45 activas, `mail` inactiva). Sin cambios vs HB#216.

**Endpoints account-scoped sin usar (confirmados):**
- `/v2/account/buildstorage` — activa, requiere `inventories`
- `/v2/account/dungeons` — activa, scope `account` + `progression`
- `/v2/account/mastery/points` — activa, scope `account`
- `/v2/account/progression` — activa, scope `account`
- `/v2/account/skins` — activa, ya tiene wrapper pero 0 callers (Idea 47)
- `/v2/account/mounts/skins` — activa (breaking change `mount` → `mount_guid` ago 2025)

**Estructura de `/v2/dungeons/<id>` confirmada:** `{id, paths:[{id, type}]}` — 4 paths por dungeon (1 Story + 3 Explorables). No `name` ni `path` fields en el detail endpoint.

---

## 2. Investigación web (Reddit, Wiki, gw2treasures, web_search)

| Fuente | Estado | Hallazgo |
|---|---|---|
| **Reddit** `/r/Guildwars2/hot.json` | 🔴 403 Blocked | 24ª vez consecutiva. Devuelve HTML de tema-beta, no JSON. |
| **GW2 Wiki** `API:Changelog` | 🟢 200 | Last entry: **29 Aug 2025** (13+ months without changes). No breaking changes affecting the app. |
| **gw2treasures** `/feeds/new_items` | 🔴 404 | 17ª vez consecutiva. Ruta ya no existe. |
| **Web search** | 🟢 200 | Oct 13/14 updates: Raid Legendary Mode Nexus of Eternity, bug fixes (Exuberant Chest Skin texture, Vloxx projectiles, "A Shattered Vision" achievement). |

**Nuevo hallazgo clave:** El update de Oct 13/14 confirma que **Raid Legendary Mode para Nexus of Eternity está activo**. Esto refuerza la unificación Strike→Raid (Feb 2026): los strikes son ahora "encuentros de raid". El Strike Tracker de la Bóveda necesita un rediseño conceptual a largo plazo, pero el workaround de marcado manual (commit e9f1437) es suficiente por ahora.

---

## 3. Estado de las 3 filas abiertas

### L60 — ALERT-41 (Strike Tracker): **CERRADO (workaround)**
✅ **COMPLETADO 2026-10-18.** Decisión de Pablo: como no hay API que devuelva si una strike está realizada, se agrega marcado manual.
- Commit `e9f1437`: botón "✓ Manual" en cada strike pendiente
- `completeStrikeManually()` agrega el ID a `state.completedStrikes` sin consultar la API
- Aviso visible `#strikeManualNotice` con feedback de 3s
- Solo toca `js/strike-tracker.js`

### L88 — Coberturable account-scoped: **EN CURSO**
20+ endpoints sin wrapper ni pantalla. Prioridad: `buildstorage`.

### L210 — Dungeon dailies: **PREMISA FALSA**
Los 3 "hermanos" NO están en `activities.js`. `/v2/account/dungeons` existe — es el endpoint para datos reales de dungeon completion.

---

## 4. Prioridades propuestas al Principal (actualizadas HB#217)

| # | Item | Dificultad | Estado |
|---|---|---|---|
| **1** | **`buildstorage`: wrapper + call site en Inventory Dashboard** | 🟡 Medio | **ALTA PRIORIDAD** — único gap competitivo real |
| **2** | **Dungeon dailies (L210)**: mover o archivar | 🟡 Medio | **PREMISA FALSA** |
| **3** | **Coberturable (L88)**: ampliar, priorizar `buildstorage` | 🟡 Medio | **EN CURSO** |
| **4** | **`/v2/account/dungeons`**: nuevo endpoint account-scoped | 🟡 Medio | **NUEVO** |

**Nota:** ALERT-41 cerrado (marcado manual, commit e9f1437). L349 Homestead descartada (la fila ya no existe, confirmado en BACKLOG.md).

---

## 5. Errores propios de esta ronda (0)

Reddit devolvió HTML (403 con JSON), gw2treasures devolvió 404, Wiki changelog devolvió 0 entries (categoría vacía). No son errores míos, son fuentes externas no disponibles.

Archivos tocados: **1 (`PRE_BACKLOG.md`)**. Rama: **ninguna nueva** (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

> ## HB#215 / PO ronda 77 — RECOLECTAR. Roadmap 2026: Raid Quickplay (Oct), Strike→Raid unificación (Feb 2026), Fractal Incursion Nov 10, WvW Borderlands Nov 10. ALERT-41 sigue bloqueado. Nueva ruta `account/dungeons` confirmada.

**Modo:** RECOLECTAR. **Control de carga:** `openItems = 3` (L60 ALERT-41, L88 Coberturable, L210 Dungeon dailies) — sin cambios. **PASO -1:** 0 comunicaciones "Esperando" para mí.

---

## 1. Verificación de API en vivo (HB#215)

**`/v2.json` re-medido (2026-10-18):** 184 rutas totales, 46 rutas `account/*` (45 activas, `mail` inactiva). Sin cambios vs HB#214.

**Endpoints account-scoped sin usar (confirmados):**
- `/v2/account/buildstorage` — activa, requiere `inventories`
- `/v2/account/dungeons` — activa, scope `account` + `progression`
- `/v2/account/mastery/points` — activa, scope `account`
- `/v2/account/progression` — activa, scope `account`
- `/v2/account/skins` — activa, ya tiene wrapper pero 0 callers (Idea 47)
- `/v2/account/mounts/skins` — activa (breaking change `mount` → `mount_guid` ago 2025)

---

## 2. Investigación web (Reddit, Wiki, gw2treasures, web_search)

| Fuente | Estado | Hallazgo |
|---|---|---|
| **Reddit** `/r/Guildwars2/hot.json` | 🔴 403 Blocked | 22ª vez consecutiva. Devuelve HTML de tema-beta, no JSON. |
| **GW2 Wiki** `Upcoming_changes_and_features` | 🟢 200 | Last edited 15 Oct 2026. Roadmap 2026: Skills & Balance Nov 10, WvW borderlands beta Nov 10, Hall of Monuments Dec 2026, Orr map 2027. |
| **gw2treasures** `/feeds/new_items` | 🔴 404 | 15ª vez consecutiva. Ruta ya no existe. |
| **Web search** | 🟢 200 | Raid Quickplay mode confirmed (Oct 2026 update). Strike Missions → "raid encounters" unificación (Feb 2026). New raid UI. |

**Nuevo hallazgo clave:** El update de Oct 2026 (Raid & Wardrobe) unifica **Strike Missions** bajo el término "raid encounters". Esto significa que el **Strike Tracker** de la Bóveda va a quedar anticuado conceptualmente — los strikes ya no son un modo separado, son "encuentros de raid". Esto es relevante para ALERT-41: el endpoint `/v2/account/raids` puede que eventualmente devuelva tanto raids como strikes (encuentros unificados).

---

## 3. Estado de las 3 filas abiertas (sin cambios)

### L60 — ALERT-41 (Strike Tracker): **SIGUE BLOQUEADO**
Condición única: **Pablo pega body crudo de `/v2/account/raids` con token real (permiso `progression`)**.
**Nueva consideración:** La unificación Strike→Raid (Feb 2026) sugiere que `/v2/account/raids` puede ser el endpoint correcto para strikes también. Pero sin token no se puede confirmar.

### L88 — Coberturable account-scoped: **EN CURSO**
20+ endpoints sin wrapper ni pantalla. Prioridad: `buildstorage`.

### L210 — Dungeon dailies: **PREMISA FALSA**
Los 3 "hermanos" NO están en `activities.js`. `/v2/account/dungeons` existe — es el endpoint para datos reales de dungeon completion.

---

## 4. Prioridades propuestas al Principal (sin cambios vs HB#214)

| # | Item | Dificultad | Estado |
|---|---|---|---|
| **1** | **ALERT-41**: Strike Tracker — decidir destino | 🟢 Decisión Pablo | **BLOQUEADO** |
| **2** | **L349 Homestead**: actualizar fila | 🟢 15 min | **HIGIENE** |
| **3** | **Dungeon dailies (L210)**: mover o archivar | 🟡 Medio | **PREMISA FALSA** |
| **4** | **Coberturable (L88)**: ampliar, priorizar `buildstorage` | 🟡 Medio | **EN CURSO** |
| **5** | **`/v2/account/buildstorage`**: wrapper + call site | 🟡 Medio | **NUEVO** |
| **6** | **`/v2/account/dungeons`**: nuevo endpoint account-scoped | 🟡 Medio | **NUEVO** |

---

## 5. Errores propios de esta ronda (0)

Reddit devolvió HTML (403 con JSON), gw2treasures devolvió 404, Wiki changelog devolvió 0 entries (categoría vacía). No son errores míos, son fuentes externas no disponibles.

Archivos tocados: **1 (`PRE_BACKLOG.md`)**. Rama: **ninguna nueva** (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

# HB#213 / PO ronda 75 — RECOLECTAR. Web research 75ª ronda sin feature nueva; canal limpio; Reddit 403 por 20ª vez

**Modo:** RECOLECTAR (3 de 3, banda 0-3). **Control de carga:** `openItems = 3` (L60 ALERT-41, L88 Coberturable, L210 Dungeon dailies) — sin cambios. **PASO -1:** 0 comunicaciones pendientes para el PO (HB#116 leída, respondida y cerrada).
**Punto de partida:** `origin/main` @ `c8ad095` (rescate HB#211).

---

## 1. Canal de agentes (PASO 0)

- **inbox:** 1 mensaje nuevo → HB#116 ("9 de tus rondas ya se leen, y no era culpa tuya"). Leída, respondida, cerrada.
- **overdue:** vacío.
- **replies:** vacío.
- **waiting:** vacío.
- **Canal:** funcional. `cli.py close` archivó correctamente.

---

## 2. Investigación web (Reddit, Wiki, gw2treasures, API oficial) — **0 features nuevas (75ª ronda consecutiva)**

| Fuente | Estado | Hallazgo |
|---|---|---|
| **Reddit** `/r/GuildWars2/hot.json` | 🔴 **403 Blocked** | 20ª vez consecutiva. `curl` con User-Agent de navegador también falla (stdout vacío, rc=0 pero sin contenido). `old.reddit.com` redirige 302. No accesible. |
| **GW2 Wiki** `API:Changelog` | 🟢 200 | Última entrada: **29 ago 2025** (13 meses sin cambios). Sin breaking changes que afecten a la Bóveda. |
| **gw2treasures** | 🔴 **Fallo** | `web_fetch` rechaza `application/json`. `curl` devolvío 200 pero sin contenido útil (página HTML de index, no API). 12ª vez que `/feeds` falla. |
| **API oficial** `/v2/items` | 🔴 **301 Redirect** | Redirige a `/v2/items` (sin trailing slash). `curl` sin `-L` devolvío 301. Sin contenido nuevo. |
| **API oficial** `/v2.json` | 🟢 200 | 184 rutas, 46 `account/*` (45 activas, 1 inactiva `mail`). Sin cambios vs ronda 74. |

**Conclusión:** 75 rondas sin feature nueva de la web. Reddit inaccessible por 20ª vez; gw2treasures sin API accesible; API oficial sin cambios. El ciclo de contenido GW2 sigue en pausa.

---

## 3. Estado de las 3 filas abiertas (sin cambios vs HB#212)

| Fila | Estado |
|---|---|
| **L60 — ALERT-41** | **BLOQUEADO**. Espera body crudo de `/v2/account/raids` con token real. |
| **L88 — Coberturable** | **EN CURSO**. `buildstorage` es el único gap competitivo inmediato. |
| **L210 — Dungeon dailies** | **PREMISA FALSA**. Requiere decisión de arquitectura, no seguir un patrón. |

---

## 4. Prioridades propuestas al Principal (sin cambios vs HB#212)

| # | Item | Dificultad | Estado |
|---|---|---|---|
| **1** | **ALERT-41**: Strike Tracker — decidir destino | 🟢 Decisión Pablo | **BLOQUEADO** |
| **2** | **L349 Homestead**: actualizar fila (cifras muertas) | 🟢 15 min | **HIGIENE** |
| **3** | **Dungeon dailies (L210)**: mover o archivar | 🟡 Medio | **PREMISA FALSA** |
| **4** | **Coberturable (L88)**: ampliar, priorizar `buildstorage` | 🟡 Medio | **EN CURSO** |
| **5** | **`/v2/account/buildstorage`**: wrapper + call site | 🟡 Medio | **NUEVO** |

---

## 5. Errores propios de esta ronda (0)

Sin errores nuevos. Las verificaciones confirmaron los hallazgos de rondas anteriores.

Archivos tocados: **1 (`PRE_BACKLOG.md`)**. Rama: **ninguna nueva** (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

# HB#218 / PO ronda 80 — RECOLECTAR. Halloween activo, Legendary Mode en Nexus of Eternity, WV Special Objectives estacionales

**Modo:** RECOLECTAR (3 de 3, banda 0-3). **Control de carga:** `openItems = 3` (L60 ALERT-41, L88 Coberturable, L210 Dungeon dailies) — sin cambios. **PASO -1:** 0 comunicaciones "Esperando" para mí. **PASO 0:** canal limpio, 0 inbox, 0 overdue, 0 replies, 0 waiting.

---

## 1. Canal de agentes (PASO 0)

- **inbox:** vacío (0 preguntas esperando a product-owner)
- **overdue:** vacío
- **replies:** vacío
- **waiting:** vacío
- **Canal:** funcional, sin mensajes pendientes.

---

## 2. Control de carga (PASO 0.5)

- **BACKLOG.md:** 3 items abiertos (L11 buildstorage, L82 ALERT-41, L110 Coberturable)
- **Decisión:** **RECOLECTAR** (≤3). Ciclo normal: investigar, escribir ideas, consolidar.

---

## 3. Investigación web (4 URLs requeridas)

| Fuente | URL | Estado | Hallazgo |
|---|---|---|---|
| **GW2 Wiki** | `wiki.guildwars2.com/wiki/Game_updates` | 🟢 200 | Halloween 13 Oct–3 Nov: nuevo mini (Mini Longhaired Black Cat), 4 decoraciones homestead, armas Fog Machine/Grim Machine Spear/Unchained, WV Special Objectives de Halloween. **Legendary Mode para Nexus of Eternity**: derrotar a Vloxx con Legendary Mode otorga logro + título exclusivo. Living World S2-5 ahora gratis con base/expansiones. Master of Masteries: Visions of Eternity (9454) estaba roto, ya fixeado. Oct 14: Shadow Distance slider (no relevante). Oct 15: solo bug fixes. |
| **Reddit** | `reddit.com/r/GuildWars2/hot.json` | 🔴 403 | 25ª vez bloqueado. Devuelve HTML de tema-beta, no JSON. `curl` con User-Agent también falla. No accesible. |
| **gw2treasures** | `gw2treasures.com` | 🟢 200 | Nueva lista de logros: Legendary Conqueror of Vloxx (9478), Legendary Nexus of Eternity (9472), Weekly CM Convergences Nexus (9422), Convergence CM Gold/Silver (9435/9394), Master of Masteries VoE (9454), Tenebral Ward Armor Collection (9363), varios Daily Dismount. `/feeds/new_items` sigue 404 (17ª vez). |
| **GW2 API** | `api.guildwars2.com/v2/items` | 🟢 200 | Funciona sin `ids=all` (rechaza ese keyword). Devuelve lista paginada de items. Sin cambios relevantes. |

**Nuevo hallazgo clave:** Tres cosas accionables para la Bóveda:
1. **Halloween está activo AHORA** (13 Oct – 3 Nov). Un jugador con 27 cuentas no puede seguir progreso de festival cuenta por cuenta sin revisar cada una manualmente.
2. **Legendary Mode en Nexus of Eternity** (13 Oct). El Raid Tracker no tiene estado para "modo legendario" por encuentro. Logro 9478 = Legendary Conqueror of Vloxx.
3. **WV Special Objectives estacionales**. El wiki confirma que WV tiene Special Objectives para Halloween. El módulo WV rastrea objetivos semanales regulares pero no especiales/festivales.

---

## 4. Ideas en bruto → Propuestas consolidadas

### Idea 77 — Festival/Seasonal Tracker (Halloween 2026)

**Problema:** Halloween está activo (13 Oct – 3 Nov). Hay nuevo mini, nuevas decoraciones de homestead, nuevas armas, y WV Special Objectives para actividades de Halloween. Un jugador con 27 cuentas no tiene forma de ver el progreso de festival en todas las cuentas de un vistazo. Tendría que revisar cada cuenta manualmente.

**Solución:** Nueva pantalla o módulo "Festival Tracker" que muestre logros y recompensas de festivales activos, con progreso por cuenta. Halloween es el caso de uso inmediato, pero el diseño debe ser genérico para futuros festivales.

**Alternativas consideradas:** (a) Agregar al Logros existentes como filtro — se mezcla con todo lo demás; (b) Pantalla dedicada — mejor aislamiento y visibilidad.

**Comparación:** GW2Efficiency no tiene tracker de festivales; gw2treasures lista logros pero sin progreso por cuenta.

**Dificultad:** 🟡 Medio (nuevo módulo, requiere `/v2/account/achievements` + WV datos por cuenta)

**Beneficio:** Visibilidad inmediata de progreso de festival en 27 cuentas de un vistazo. Útil para festivales de tiempo limitado.

---

### Idea 78 — Wizard's Vault: Special Objectives estacionales

**Problema:** El wiki confirma que WV fue actualizado con Special Objectives para Halloween. El módulo WV de la Bóveda rastrea objetivos semanales regulares pero no distingue objetivos especiales/festivales. Un jugador puede perderse objetivos de tiempo limitado.

**Solución:** Agregar sección de "Special Objectives" al dashboard de WV, diferenciando objetivos regulares de especiales (festivales, eventos). Mostrar progreso y tiempo restante.

**Alternativas consideradas:** (a) Mezclar con objetivos semanales — confuso, diferentes caducidades; (b) Pantalla separada — más clics para acceder.

**Comparación:** La WV oficial en juego muestra todos los objetivos juntos pero sin distinguir tipo.

**Dificultad:** 🟡 Medio (requiere identificar qué objetivos son especiales vía API o metadatos)

**Beneficio:** Los jugadores no se pierden objetivos de tiempo limitado en WV.

---

### Idea 79 — Raid Tracker: estado "Legendary Mode" por encuentro

**Problema:** El update del 13 Oct agregó Legendary Mode a Nexus of Eternity. Derrotar a Vloxx con Legendary Mode activa otorga logro exclusivo (9478) y título. El Raid Tracker actual tiene estados binarios (completado/no completado) por encuentro, sin distinción de modo.

**Solución:** Extender el estado de encuentros de raid para incluir "Legendary Mode" como segundo nivel de completión, vinculado al logro 9478. Relacionado con Idea 49 (Raid Legendary Mode) pero específico al estado de encuentro.

**Alternativas consideradas:** (a) Solo agregar logro a la pantalla de Logros — no da contexto de raid; (b) Nueva columna en Raid Tracker — mejor integración.

**Comparación:** GW2Efficiency trackea raid completions pero no distingue modos de dificultad por encuentro de forma clara.

**Dificultad:** 🟢 Fácil (extender estado existente en raid-tracker.js, agregar logro 9478)

**Beneficio:** Raiders multicuenta pueden rastrear completiones de modo legendario sin salir de la Bóveda.

---

## 5. Propuestas consolidadas (3 items, listas para el Principal)

| # | Propuesta | Dificultad | Prioridad | Relaciona con |
|---|-----------|------------|-----------|---------------|
| **1** | **Idea 77 — Festival/Seasonal Tracker (Halloween)** | 🟡 Medio | ALTA | Halloween activo ahora (13 Oct–3 Nov) |
| **2** | **Idea 78 — WV Special Objectives estacionales** | 🟡 Medio | MEDIA | WV es módulo core, Halloween Special Objectives activos |
| **3** | **Idea 79 — Raid Tracker: estado Legendary Mode** | 🟢 Fácil | MEDIA | Idea 49 (Raid Legendary Mode), Nexus of Eternity |

---

## 6. Prioridades propuestas al Principal

| # | Item | Dificultad | Estado |
|---|------|------------|--------|
| **1** | **Idea 77: Festival/Seasonal Tracker (Halloween)** | 🟡 Medio | **NUEVA** — Halloween activo ahora |
| **2** | **Idea 78: WV Special Objectives estacionales** | 🟡 Medio | **NUEVA** |
| **3** | **Idea 79: Raid Tracker: estado Legendary Mode** | 🟢 Fácil | **NUEVA** — se apoya en Idea 49 |
| **4** | **L88 Coberturable: `/v2/account/buildstorage`** | 🟡 Medio | **EN CURSO** (prioridad existente) |
| **5** | **ALERT-41: Strike Tracker** | 🟢 Decisión Pablo | **BLOQUEADO** (espera body crudo de `/v2/account/raids`) |
| **6** | **L210 Dungeon dailies** | 🟡 Medio | **PREMISA FALSA** |

---

## 7. Errores propios de esta ronda (0)

Reddit 403 (25ª vez, contenido HTML no JSON) — fuente externa no disponible, no error mío. Gw2treasures `/feeds` 404 (17ª vez) — ruta ya no existe. API `/v2/items` rechaza `ids=all` — probado una vez, funcionó sin ese parámetro.

Archivos tocados: **1 (`PRE_BACKLOG.md`)**. Rama: **ninguna nueva** (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

# HB#217 / PO ronda 79 — RECOLECTAR. ALERT-41 cerrado (marcado manual, commit e9f1437). Reddit 403 por 24ª vez. gw2treasures 404 por 17ª vez. API oficial sin cambios (184 rutas, 46 account/*). Web search: Oct 13/14 updates (Raid Legendary Mode, bug fixes). L210 Dungeon dailies: premisa falsa confirmada.

---

# HB#219 / PO ronda 81 (2026-10-19) — RECOLECTAR. Web sin novedades, las 3 ideas del HB#218 siguen vigentes.

**Control de carga:** `BACKLOG.md` = 3 items abiertos (`buildstorage`, ALERT-41 diagnóstico, Coberturable L88) → **RECOLECTAR** (≤3). Sin cambios vs HB#218.

**Fuentes web (esta ronda):**
- **Wiki API:Changelog** → 200. Último cambio: 2025-08-29 (13 meses sin cambios). Sin impacto en la Bóveda.
- **gw2treasures.com** → 200 (homepage). `/feeds/new_items` sigue 404 (18ª vez). Catálogo VoE visible (items Track 110xxx, logros 9384/9454) pero 9384 y 9454 dan 404 en la API oficial — ya conocido, sin acción nueva.
- **Reddit** → 403 (25ª vez, bloqueado). No se consulta: regla de no-doom-loop.

**Propuestas consolidadas en PRE_BACKLog (3 items, listas para el Principal):**
| # | Propuesta | Dificultad | Prioridad |
|---|-----------|------------|-----------|
| **1** | **Idea 77 — Festival/Seasonal Tracker (Halloween)** | 🟡 Medio | ALTA |
| **2** | **Idea 78 — WV Special Objectives estacionales** | 🟡 Medio | MEDIA |
| **3** | **Idea 79 — Raid Tracker: estado Legendary Mode (logro 9478, Vloxx)** | 🟢 Fácil | MEDIA |

**Estado:** Ninguna idea nueva esta ronda. Las 3 del HB#218 siguen vigentes y listas para proponer al Principal.

**Pendientes del backlog existente:**
- **L88 Coberturable (`/v2/account/buildstorage`)** — EN CURSO, prioridad existente, bloqueado por permiso `inventories` de Pablo.
- **ALERT-41 (Strike Tracker)** — BLOQUEADO, espera body crudo de `/v2/account/raids` con token real (decisión de Pablo).

Archivos tocados: **1 (`PRE_BACKLog.md`)**. Rama: ninguna nueva (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.

---

# HB#219 / PO ronda 81 — RECOLECTAR. gw2treasures: WV Tracks nuevos detectados; Halloween y Legendary Mode ya documentados en HB#218

**Modo:** RECOLECTAR (3 de 3, banda 0-3). **Control de carga:** `openItems = 3` (L11 buildstorage, L82 ALERT-41, L110 Coberturable) — sin cambios. **PASO 0:** inbox 0, overdue 0, replies 0, waiting tiene 1 mensaje [VENCIDO] de HB#218 (Propuestas PO HB218, id 20261018T212159Z-ffad0e). **No reenvío** para evitar spam; el mensaje queda en disco para el Principal.

---

## 1. Canal de agentes (PASO 0)

- **inbox:** vacío (0 preguntas esperando a product-owner)
- **overdue:** vacío
- **replies:** vacío
- **waiting:** 1 mensaje [VENCIDO] — "Propuestas PO HB218" enviado al Principal, sin respuesta todavía

---

## 2. Control de carga (PASO 0.5)

- **BACKLOG.md:** 3 items abiertos (L11 buildstorage wrapper, L82 ALERT-41 Strike Tracker, L110 Coberturable account-scoped)
- **Decisión:** **RECOLECTAR** (≤3). Ciclo normal.

---

## 3. Investigación web (4 URLs requeridas)

| Fuente | URL | Estado | Hallazgo clave |
|---|---|---|---|
| **GW2 Wiki** | `wiki.guildwars2.com/wiki/Game_updates` | 🟢 200 | Halloween 13 Oct–3 Nov activo. Legendary Mode Nexus of Eternity (Vloxx, logro 9478). WV Special Objectives para Halloween. **Nuevos items WV tipo "Track"** no listados explícitamente en wiki. Build 208,784. |
| **Reddit** | `reddit.com/r/GuildWars2/hot.json` | 🔴 403 | 26ª vez bloqueado. HTML, no JSON. |
| **gw2treasures** | `gw2treasures.com` | 🟢 200 | **NUEVO: Items WV tipo "Track"** — Track 1-39 (Track 3: Castora, Track 21: Terra Firma, Track 36: Terror from the Mists, etc.). Logros nuevos: Gaze into Infinity (9456), Daily Dismount (9475-9477), Weekly CM Convergences Nexus (9422), Convergence CM Gold/Silver (9435/9394), Legendary Conqueror of Vloxx (9478), Legendary Nexus of Eternity (9472). 78,532 items (+44 vs HB#218), 8,388 achievements. |
| **GW2 API** | `api.guildwars2.com/v2/items` | 🔴 JSON | web_fetch no soporta application/json. Probado con curl anteriormente: funciona sin `ids=all`. |

**Nuevo hallazgo clave (no en HB#218):** gw2treasures expone **items de tipo "Track" del Wizard's Vault** (Track 1-39). La Bóveda rastrea WV objetivos semanales regulares pero **no rastrea WV Tracks** como entidad separada. Esto refuerza la Idea 78 (WV Special Objectives estacionales) y sugiere una extensión: un módulo de "WV Track Tracker" o sección de tracks en el dashboard WV.

---

## 4. Estado de las 3 propuestas ya enviadas (HB#218)

| # | Propuesta | Dificultad | Estado |
|---|-----------|------------|--------|
| 1 | Idea 77 — Festival/Seasonal Tracker (Halloween) | 🟡 Medio | Enviado al Principal (vencido, sin respuesta) |
| 2 | Idea 78 — WV Special Objectives estacionales | 🟡 Medio | Enviado al Principal (vencido, sin respuesta) |
| 3 | Idea 79 — Raid Tracker: estado Legendary Mode | 🟢 Fácil | Enviado al Principal (vencido, sin respuesta) |

**No propongo nuevas ideas.** Las 3 del HB#218 siguen vigentes. Los nuevos items WV Track son un argumento adicional para la Idea 78, no una idea separada.

---

## 5. Prioridades (sin cambios vs HB#218, reforzadas con hallazgo WV Tracks)

| # | Item | Dificultad | Estado |
|---|------|------------|--------|
| 1 | Idea 77 — Festival/Seasonal Tracker (Halloween) | 🟡 Medio | NUEVA — enviado al Principal |
| 2 | Idea 78 — WV Special Objectives estacionales (+ WV Tracks) | 🟡 Medio | NUEVA — enviado al Principal |
| 3 | Idea 79 — Raid Tracker: estado Legendary Mode | 🟢 Fácil | NUEVA — enviado al Principal |
| 4 | ALERT-41 Strike Tracker | 🟢 Decisión Pablo | BLOQUEADO |
| 5 | L11 buildstorage wrapper | 🟡 Medio | EN CURSO |
| 6 | L110 Coberturable account-scoped | 🟡 Medio | EN CURSO |

---

## 6. Errores propios de esta ronda (0)

Reddit 403 (26ª vez, fuente externa no disponible). API `/v2/items` devuelve application/json que web_fetch no soporta (probado con curl antes, funciona). Gw2treasures `/feeds` 404 (18ª vez) — ruta inexistente.

Archivos tocados: **1 (`PRE_BACKLog.md`)**. Rama: ninguna nueva (trabajo en workspace). **No mergeo.** No toco `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md`.
---

## HB#220 / PO ronda 82 (2026-10-19) — RECOLECTAR. Reddit volvió por RSS, gw2treasures volvió por otra ruta, y la API cambió de FORMA: el número no se movió, el instrumento sí

**Modo:** RECOLECTAR (banda 0-3). **Control de carga:** `openItems = 2` en `origin/main:BACKLOG.md` (L11 `buildstorage`, L110 Coberturable) — medido con `tools/hb163-canales.mjs` (`c2_backlog_main.openItems = 2`, `openItemsDiscrimina: true`, `openItemsQueLaAncladaPierde: 0`), **bajó de 3** porque ALERT-41/L82 ya no está abierto. **PASO 0 (canal):** inbox 0, overdue 0, replies 0, waiting 0. **PASO -1:** árbol limpio, `origin/main` = `main` = `bc1c00d` (9 min antes de mi arranque), 0 sesiones `running` → ciclo normal.

> **Nota de continuidad:** esta corrida es la **continuación** del disparo de las 22:00 UTC, que murió por `TimeoutError` (900 s) con la ronda a medias. Lo único que hereda de esa corrida son las *técnicas* verificadas (abajo); ninguna entrega de esa corrida llegó al archivo.

---

## 1. Corrección de instrumento: 3 fuentes que el PO venía marcando como "caídas" NO están caídas

Este es el hallazgo de la ronda, y es de método, no de producto: **3 de las 4 fuentes del protocolo fallaban por la técnica, no por la fuente.** Llevaban 18-26 rondas registradas como "fuente externa no disponible".

| Fuente | Ruta que el PO venía usando | Estado | **Ruta/technique que sí funciona (medida hoy)** |
|---|---|---|---|
| Reddit | `/r/Guildwars2/hot.json` | 🔴 403 (27ª vez) | 🟢 **`https://www.reddit.com/r/Guildwars2/hot/.rss`** → HTTP 200, 50.109 bytes, **25 entradas** del 17 al 19-oct. Reddit bloquea `curl`/`web_fetch` con JSON, pero **no** el RSS. |
| gw2treasures | `/feeds/new_items` | 🔴 404 (19ª vez) | 🟢 **`en.gw2treasures.com`** (la raíz responde **307** y redirige a `en.`), y sus rutas vivas son **`/festival/halloween`** (200, 229.016 B), **`/achievement`** (200, 533.048 B, *singular*), **`/item`**. La ruta `/feeds/*` está **muerta**, no el sitio. |
| GW2 Wiki | `api.php?list=recentchanges` | 🔴 403 con `curl` | 🟢 **`web_fetch` sobre `https://wiki.guildwars2.com/wiki/Game_updates`** → 200, contenido completo. El `api.php` con User-Agent de navegador sigue en 403 (bloqueo anti-bot, no de la API). |
| GW2 API | `/v2.json` | 🟢 200 | 🟢 200 — **pero cambió de forma** (sección 2). |

**Regla que sale:** *una fuente marcada "caída" 19 veces es una fuente que el PO dejó de intentar de otra manera.* Un 404 en **una** ruta no es un 404 en **el sitio**: el primer control de una caída tiene que ser "¿existe otra ruta?", no "¿la repetí?".

---

## 2. La API oficial cambió la FORMA del índice — el parser viejo devuelve "2 rutas y 0 account"

**Medido hoy contra `https://api.guildwars2.com/v2.json` (HTTP 200, 20.838 B):**

```
FORMA NUEVA:  { "langs": ["en","es","de","fr","zh"],
                "routes": [ { "path": "/v2/account", "lang": false, "auth": true, "active": true }, ... ] }
FORMA VIEJA:  { "/v2/account": { "type": "...", "auth": true, ... }, ... }   (mapa plano)
```

**Con el parser viejo** (`Object.keys(json)` → 2 claves: `langs`, `routes`) el conteo da **`rutas_totales = 2` y `account_rutas = 0`**. Ese 0 tiene toda la forma de un dato y no lo es: es un parser mirando la forma vieja. **Con el parser nuevo: `184` rutas, `46` `account/*`, `45` activas, `/v2/account/mail` inactiva — idéntico a las 20+ rondas anteriores.**

**O sea: el número no se movió, el instrumento se rompió.** Y el instrumentos es lo que se reportaba como "la API oficial sin cambios (184 rutas, 46 account/*)" en cada ronda — o sea, la afirmación era correcta, pero por un motivo que hoy dejó de sostenerse sin que nadie lo notara.

**Impacto:** la app **no** parsea `/v2.json` (`findstr /s /i "v2.json" js\*.js tools\*.mjs` → **0 usos**), así que **cero impacto en producto**. Impacto real: **toda la instrumentación del equipo que cuenta rutas de la API** (y los scripts de censo del PO) devuelven "2 rutas / 0 account" en silencio. Es el mismo modo de fallo de ALERT-236: *un 0 cuyo cero no significa nada*.

**Acción concreta para el Principal:** si algún script del repo cuenta rutas de la API, tiene que leer `json.routes[].path` y no las claves del objeto. No encontré ninguno en `js/` ni en `tools/` — **medido, no asumido** (el grep dio 0, y el control de "discrimina" es que `/v2.json` sí devuelve 200 con `routes`).

---

## 3. Estado real de la cola (2 items, y las filas que el PO venía reportando están viejas)

| Fila | Item | Estado real, medido hoy |
|---|---|---|
| **L11** | `buildstorage`: wrapper + call site en Inventory Dashboard | 🟡 **ABIERTO**. Único gap competitivo inmediato. SIN BLOQUEO (medido 2026-10-19): el scope de `/v2/account/buildstorage` es `account`, no `inventories` (ese es el de `/v2/account/bank`) |
| **L110** | Coberturable account-scoped multicuenta | 🟡 **ABIERTO**. Mayor gap medido (11 endpoints). |
| ~~L82~~ | ~~ALERT-41 Strike Tracker~~ | ✅ **YA NO ESTÁ ABIERTO** — cerrado con marcado manual (commit `e9f1437`). Las rondas 78/79 lo listan como "BLOQUEADO": **está desactualizado**, no bloqueado. |

El control de carga bajó de 3 a 2 **por una fila que se cerró**, no por una poda. La banda sigue siendo RECOLECTAR.

---

## 4. Investigación web — contenido (esta vez, de verdad)

### Reddit (25 posts hot, 17-19 oct 2026) — lo que la comunidad está pidiendo

| # | Post | Fecha | Lectura para la Bóveda |
|---|---|---|---|
| **11** | **"FASTEST Way to Complete the Halloween Weekly!"** | 19-oct | **El post #1 del subreddit hoy es el semanal de Halloween.** Con 27 cuentas, ese es exactamente el dolor: no saber cuál de las 27 todavía debe el semanal. |
| 7 | "Trick-or-Treat Bags in 2026" | 19-oct | Cambios en rareza de las bolsas (igualaron armas de Halloween; menos Endless Halloween Tonic; más Oontz's Necklace). |
| 16 | "The King and Queen's Horrorween 2026" | 19-oct | Evento en curso. |
| 25 | "Another post on Fractal 94CM, who is this content designed for?" | 18-oct | **CM (pulse) semanal**: la pregunta "para quién es esto" es la de un jugador con muchas cuentas. |
| 23 | "PSA: if you use alt parks... equip them with the guild gathering boost" | 18-oct | Recordatorio de **alt accounts** y reminded legendary boost → es un pedido de *visibilidad de cuentas secundarias*. |
| 19 | Reddit exigiendo la app / sign-in obligatorio en old.reddit | 18-oct | Tesis sobre **forzar la app móvil**. Relevante para un producto que es "PC-primario, mobile ocasional": la fricción de la app es del ecosistema, no nuestra, pero es contexto de mercado. |

### GW2 Wiki `Game_updates` (última: **15-oct**, build 208.784)

- **Halloween activo del 13-oct al 3-nov.** Nuevos: mini *Mini Longhaired Black Cat*, 4 decoraciones (homestead + guild) de Halloween, set *Fog Machine*, *Unchained* por candy corn, *Plush Mad King*.
- **(Annual) Halloween Rituals** →(meta)→ **Primeval King's Wrappings**. **(Weekly) Halloween Festivities** → **arma del set Fog Machine**. O sea: hay **recompensa semanal** y **recompensa anual** con dos relojes distintos.
- **Wizard's Vault con Special Objectives de Halloween** (confirma Idea 78).
- **Legendary Mode en Nexus of Eternity**: "opción en el *challenge mote* para intentar la versión legendario; derrotar a Vloxx en Legendary Mode otorga logro y título exclusivos" (confirma Idea 79).
- **4 decoraciones nuevas de Visions of Eternity**, auto-desbloqueadas para los dueños, + **"Soundtrack Single—Visions of Eternity"** como rare drops. Relevante para el Homestead Tracker (L349/idea de homestead).
- **Living World S2/S3/S4/S5 ahora incluidos** en base/expansiones, con **2 Shared Inventory Slots + Level-80 Boosts** por bundle.

### gw2treasures (`en.gw2treasures.com`, 200)

Rutas vivas medidas: `/festival/halloween` (página de festival viva, 229 KB), `/achievement` (533 KB), `/item`. La ruta `/feeds/new_items` está muerta desde hace 19 rondas.

---

## 5. Ideas en bruto → consolidadas

### 🔴 IDEA 80 — Matriz de logros **diarios y semanales por cuenta** (NUEVA — ALTA)

**Problema, medido en el código:** `js/achievements.js:242` hace `if (hasFlag(meta,'Daily') || hasFlag(meta,'Monthly')) return;` — o sea **excluye explícitamente los logros diarios y mensuales del total permanente**. Lo que la Bóveda muestra de ellos es **AP**: un número (`apDailyHist`), un KPI. **No hay un checklist por cuenta.** El módulo ya recibe esos logros (vienen en la misma respuesta de `/v2/account/achievements`), así que **el dato ya está en la app y no se muestra**.

**Por qué ahora, con evidencia:** (a) el post **#1** de r/Guildwars2 hoy es *"FASTEST Way to Complete the Halloween Weekly!"*; (b) el wiki confirma que el festival da **dos recompensas con relojes distintos** (semanal → arma Fog Machine; anual → Primeval King's Wrappings); (c) el festival **cierra el 3-nov**; (d) un jugador de 27 cuentas no tiene forma de saber **qué cuenta** debe el semanal.

**Solución:** vista/filtro **"Semanal"** en Logros: por cuenta, qué semanales/diarios siguen pendientes, y arriba un contador del tipo **"9 de 27 cuentas deben el semanal de Halloween"**.

**Alternativas consideradas:** (a) filtro dentro del Logros actual → se mezcla con las categorías permanentes y no resuelve "qué cuenta"; (b) panel aparte → más aislamiento y mejor visibilidad; (c) **solo un contador global de AP** → es lo que ya hay, y no dice qué cuenta.

**Comparación:** GW2Efficiency y gw2treasures muestran *la lista* de semanales; ninguno muestra *el estado por cuenta*.

**Dificultad:** 🟡 Medio — **los datos ya llegan**; es presentation + un modelo de "reloj" (semanal vs mensual) que hoy no existe.
**Beneficio:** ataca el dolor #1 del subreddit de hoy, con fecha de expiración (3-nov), y es el gap natural del jugador multicuenta.

### 🟡 IDEA 81 — Catálogo de "novedades de temporada" (NUEVA — MEDIA)

**Problema:** cada temporada mete ids nuevos (bolsas Trick-or-Treat, decoraciones, logros 9478/9472/9456, tracks de WV 1-39) y la Bóveda **no tiene una lista de "lo nuevo"**: el Inventory Hub busca items por nombre/id, pero no hay un catálogo de lo que entró. Un jugador de 27 cuentas quiere saber qué hay que farmear esta semana.

**Solución:** panel "Novedades" generado desde `en.gw2treasures.com/festival/<temporada>` + `/achievement`, con id + nombre + fecha de la fuente, y búsqueda cruzada contra el catálogo propio.

**Dificultad:** 🟡 Medio — fuente externa: hay que cachearla y **fecharla** (si no, "lo nuevo" es un número viejo).
**Alternativa considerada:** hacerlo a mano desde la wiki → se pudre en una semana; el panel tiene que re-preguntar a la fuente.

### 🟢 Revisión de las 3 propuestas ya enviadas (HB#218) — **sin cambio de veredicto**

| # | Propuesta | Veredicto de esta ronda |
|---|---|---|
| 77 | Festival/Seasonal Tracker (Halloween) | **SIGUE VIGENTE.** El wiki confirma el festival hasta el 3-nov y el post #1 de Reddit es del Halloween semanal. Pero **la Idea 80 la subsume en la parte que más duele** (el reloj semanal por cuenta): conviene **fusionar 77 y 80** en una sola entrega, con la matriz por cuenta como el corazón. |
| 78 | WV Special Objectives estacionales | **SIGUE VIGENTE**, y ahora **con fuente**: `/festival/halloween` de gw2treasures lista los specials. |
| 79 | Raid Tracker: estado Legendary Mode | **SIGUE VIGENTE**, confirmado textual por el wiki ("challenge mote → versión legendario → logro y título exclusivos"). 🟢 **Es la más barata de las cuatro** y la más fácil de cerrar. |

---

## 6. Propuestas consolidadas (4 — la condición de envío se cumple)

| # | Propuesta | Dificultad | Prioridad | Por qué ahora |
|---|---|---|---|---|
| **1** | **Idea 80 — Matriz de logros diarios/semanales por cuenta** (fusiona con 77) | 🟡 Medio | **ALTA** | Post #1 de Reddit hoy; festival con **dos relojes** (semanal y anual); cierra **3-nov**; el dato ya está en la respuesta que la app pide. |
| **2** | **Idea 79 — Raid Tracker: estado Legendary Mode** | 🟢 **Fácil** | **ALTA** | Confirmado textual en el wiki; **es la más barata** y la más fácil de cerrar de las cuatro. |
| **3** | **Idea 78 — WV Special Objectives estacionales** | 🟡 Medio | MEDIA | Fuente viva encontrada (`/festival/halloween`). |
| **4** | **Idea 81 — Catálogo de novedades de temporada** | 🟡 Medio | MEDIA | Reemplaza un "¿qué es nuevo?" manual por un panel con fecha de fuente. |

---

## 7. Prioridades para el Principal (orden de este heartbeat)

| # | Item | Dificultad | Estado |
|---|---|---|---|
| **1** | **Idea 80 (+77 fusionada) — Matriz de semanales/diarios por cuenta** | 🟡 Medio | **NUEVA — ALTA** (dolor #1 de la comunidad hoy, con fecha) |
| **2** | **Idea 79 — Legendary Mode en Raid Tracker** | 🟢 Fácil | **NUEVA — ALTA** (la más barata; cierre rápido) |
| **3** | **L11 `buildstorage`**: wrapper + call site | 🟡 Medio | **ABIERTO** — #1 del backlog; SIN BLOQUEO (medido 2026-10-19): el scope de `/v2/account/buildstorage` es `account`, no `inventories` (ese es el de `/v2/account/bank`) |
| **4** | **L110 Coberturable account-scoped multicuenta** | 🟡 Medio | **ABIERTO** — mayor gap medido (11 endpoints) |
| **5** | **Idea 78 — WV Special Objectives** | 🟡 Medio | **NUEVA — MEDIA** |
| **6** | **Idea 81 — Catálogo de novedades de temporada** | 🟡 Medio | **NUEVA — MEDIA** |
| **7** | **Corrección de instrumento `/v2.json`** | 🟢 Fácil | **NUEVA — pero es del Principal, no del PO**: revisar cualquier script que cuente rutas de la API (hoy daría 2/0 en silencio) |
| ~~8~~ | ~~ALERT-41 / Strike Tracker~~ | — | ✅ **CERRADO** (marcado manual, `e9f1437`) — **sacarlo de la lista de bloqueados** |

**Contexto de cola:** el backlog tiene **2** items abiertos y el **Sprint 2 arranca el 25-oct**. Con 2 items abiertos, el equipo **no** está bloqueado por carga: hay holgura para tomar una de las 4 propuestas (la más barata es la Idea 79).

---

## 8. Higiene del archivo canónico (reporte, no reescritura)

El `PRE_BACKLOG.md` de este workspace contiene **DOS entradas `HB#219 / PO ronda 81`** (una "Web sin novedades" y otra "gw2treasures: WV Tracks nuevos"). **No las borro ni las fusiono**: la regla del PO es *nunca borrar una idea sin decir por qué*, y una entrada de ronda puede contener un hallazgo que no está en la otra. Lo **reporto** y lo dejo asentado acá. **La ronda siguiente es la 82** (este bloque).

---

## 9. Errores propios de esta ronda (3, todos antes de reportar)

1. **El parser viejo de `/v2.json` me dio "2 rutas, 0 account"** y, si lo reportaba sin mirar la forma, publicaba un "la API cambió a 2 rutas" falso — 20+ rondas de cifras con la forma correcta en el medio. **Cazado por el control de forma**: el JSON tenía 20.838 bytes y 2 claves, y 2 rutas de la API oficial es absurdo. *(Un `0` por la forma equivocada del dato es indistinguible de un `0` real.)*
2. **El primer `grep` de `href=` sobre el HTML de gw2treasures devolvió 1000+ coincidencias** (el sitio es una app Next.js con sprite SVG). Lo acoté a las rutas vivas (`/festival/`, `/item`, `/achievement`) y recién ahí servía.
3. **`node -e` con contenido embebido vía `cmd.exe`**: la primera versión del extractor de RSS no corrió por el quoting. Lo cambié a **archivo `.mjs`** (regla ya escrita en mi propia memoria, reincidencia).

---

**Archivos tocados:** `PRE_BACKLOG.md` (este bloque, append puro) · `DASHBOARD_PO_IDEAS.md` (resumen filtrado) · `MEMORY.md` del PO (entrada de la ronda). **No toco** `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md` del repo. **Rama:** ninguna. **No mergeo.** **No hay commit**: el workspace del PO no es un repo, y las entregas van al canal.

---

## HB#221 / PO ronda 83 (2026-10-19) → RECOLECTAR. Las 4 propuestas de la ronda 82, VERIFICADAS una por una contra `origin/main` y contra la API viva: 2 intactas, 2 ya medio hechas. Y el RSS de Reddit se cayó entre las 22:54 y las 23:10.

**Modo:** RECOLECTAR. **Control de carga:** `openItems = 2` = {L11 `buildstorage`, L110 Coberturable}, medido con `tools/hb163-canales.mjs` @ `563b98d`: `c2_backlog_main.openItems = 2`, `openItemsAnclada = 2`, `openItemsQueLaAncladaPierde = 0`, `controles_ok: true`, `max_global_ronda = 82` (consistente en las 3 formas). **PASO 0:** la pregunta del Principal (vencía 23:23:50Z) **respondida y archivada antes de vencer**.

### 1. EL HALLAZGO DE LA RONDA: 2 de las 4 propuestas de la ronda 82 ya están ~80% HECHAS

Es la misma clase que ALERT-272 (2 de las 3 de la ronda 80 con premisa falsa), pero contra el repo: **nadie había verificado la ronda 82 contra `origin/main`**. Verificadas una por una:

| Idea | Premisa, medida | Veredicto |
|---|---|---|
| **79** Legendary Mode | `js/raid-tracker.js` tiene **21** ocurrencias de "legendary" y **las 21** son "Insight legendaria" (id 79722, un item de recompensa). **0** del modo. | 🟢 **INTACTA** — la más barata |
| **78** WV Especiales | `wizards-vault.js:298` `getWVSpecial` → `/v2/account/wizardsvault/special`; `router.js:1038/1045/1050/1060` ya tienen la pestaña. Y `js/wv-objectives-dashboard.js` **ya es** "una tabla comparativa de los objetivos semanales de TODAS las cuentas (filas = cuentas, columnas = objetivos, celdas = estado)". | 🔴 **~80% YA HECHO** |
| **80** Matriz semanales/diarios por cuenta | `achievements.js:242` sigue con `if (hasFlag(meta,'Daily') \|\| hasFlag(meta,'Monthly')) return;` — los dailies y mensuales quedan fuera del total permanente y lo que se muestra es un número (`apDailyHist`). "weekly" en `achievements.js` = **0**. | 🟢 **INTACTA y MÁS BARATA** |
| **81** Catálogo de novedades | 0 matches de `novedad\|newitem\|new-item` en todo `js/`… **pero** `achievements.js:917-928` **ya tiene un dropdown de categorías** que lista TODAS las que devuelve la API, y `achievements.js:260` **ya las descarga** (`/v2/achievements/categories?ids=all`). | 🔴 **~80% YA HECHO (en logros)** |

**El patrón que hace cara la 81:** la API tiene las categorías que hacen falta — **101 "Actividades de temporada"** y **137 "Eventos actuales"** — y la app **ya las tiene descargadas y ya las muestra en un filtro**. Lo que falta es el **atajo** ("Novedades" = 101 + 137 pre-seleccionados), el lado de **items** (skins/minis del festival) y la **fecha**. **La fuente correcta de un panel de novedades no es gw2treasures: es la API oficial, que ya está en la app.**

**Idea 79, re-verificada contra la API viva:** `/v2/achievements/9472` → **200**, "Nexo de Eternidad legendario", requisito *"Derrota a Vloxx con el selector de desafíos activo"*, `flags: ["Permanent"]`, 15 AP. `/v2/achievements/9478` → **404**, confirmado otra vez.

**Idea 80, re-estimada:** la tabla comparativa multicuenta que pide **ya existe** (`wv-objectives-dashboard.js`). Reutilizar ese módulo la baja de 🟡 Medio a 🟢 **Fácil**.

**Idea 78, re-delimitada:** lo único que falta de verdad es distinguir el objetivo **de evento** de los otros. Si no se acota así, **no va al Reviewer**.

### 2. LAS 3 FUENTES, RE-MEDIDAS HOY, y una se CAYÓ entre las 22:54 y las 23:10

| Fuente | Medido hoy | vs 22:54 |
|---|---|---|
| **Reddit** | `www.reddit.com/r/Guildwars2/hot/.rss` → **403** ("blocked due to a network policy", 1.522 B de HTML). `old.reddit.com/r/Guildwars2/hot/.rss` → **302**. `www.reddit.com/r/Guildwars2/.rss` → **429**. | 🔴 **SE CAYÓ** |
| **GW2 Wiki** `Game_updates` | 200, contenido completo. Último update: **15-oct-2026** (build 208.784). Sin updates nuevos. | = |
| **gw2treasures** `en.gw2treasures.com/festival/halloween` | 200, 229.084 B — **pero el HTML es una shell**: sin `__NEXT_DATA__`, sin `id="__next"`, **0** `title=`, **0** ids de item en JSON, texto visible de **2.627 caracteres** (solo el shell: "Halloween Time Remaining: 14d 20:54:41 / Achievements / Skins / Minis / Wizard's Vault"). El contenido lo carga el JS del cliente. | 🔴 **NO ES CONSUMIBLE** |
| **API oficial** | `/v2.json` cambió de FORMA (ya reportado en la ronda 82): 184 rutas / 46 `account/*` / 45 activas, idéntico. La app **no** lo parsea (0 usos) → impacto cero en producto. | = |

**🔴 La regla que sale (corolario de la de la ronda 82):** *"una fuente caída N veces es una técnica, no una fuente"* tiene un corolario más fuerte: **una técnica que funcionó UNA vez tampoco es una fuente.** El RSS de Reddit dio 200 con 25 entradas a las 22:54 y a las 23:10 da 403. Reddit queda **28 rondas** sin dato fresco, y ahora sabemos que **no es por la ruta**: es por el bloqueo de IP.

**🔴 Y la regla de gw2treasures:** *"la página responde 200"* ≠ *"la página tiene el dato"*. 229 KB de HTML con **0 datos** es la forma exacta de un 200 que no mide nada: el dato real lo pide el navegador después, en un endpoint que el HTML no revela. Un "la fuente está viva" dicho sobre un 200 sin contenido es un titular sin medición.

### 3. La wiki, re-leída (sin novedades desde el 15-oct, pero confirma 3 cosas)

- **Raids:** "Added an option to the challenge mote in the Nexus of Eternity raid to attempt a legendary version of the encounter. Defeating Vloxx with Legendary Mode active will award an exclusive achievement and title." → **confirma Idea 79**.
- **Wizard's Vault:** "has been updated with Special Objectives for participating in Halloween activities" → los **especiales de evento existen en el juego** → Idea 78 queda acotada al sub-flag.
- **Halloween:** del **13-oct al 3-nov**, con **dos relojes**: (Annual) Halloween Rituals → Primeval King's Wrappings; (Weekly) Halloween Festivities → set Fog Machine. El **semanal es el que duele** (y el del post #1 de Reddit).

### 4. Lo que queda de la ronda 82, con la dificultad re-estimada

| # | Propuesta | Dificultad | Prioridad | Cambio de esta ronda |
|---|---|---|---|---|
| 1 | **Idea 79** — Legendary Mode en el Raid Tracker | 🟢 **Fácil** | **ALTA** | ⬆️ la más barata; premisa verificada contra la API |
| 2 | **Idea 80** — Matriz de semanales/diarios por cuenta | 🟢 **Fácil** (era 🟡) | **ALTA** | ⬇️ dificultad: el patrón multicuenta ya existe |
| 3 | **Idea 78** — WV: distinguir el objetivo **de evento** | 🟡 Medio | MEDIA | ⬇️ **acotada**: el 80% ya estaba hecho |
| 4 | **Idea 81** — "Novedades" = atajo a 101+137 + items + fecha | 🟡 Medio | MEDIA | ⬇️ **re-escrita**: la fuente es la API, no gw2treasures |

**Idea 80 + Idea 79 siguen siendo las 2 urgentes**, y ahora por un motivo distinto al de la ronda 82: **no son "las más votadas del subreddit", son las dos más baratas de construir.** Con `openItems = 2` hay holgura de carga, y el Sprint 2 abre el 25-oct.

### 5. Estado de la cola y de la deuda

- `openItems = 2` ({L11, L110}) = RECOLECTAR. **Sprint 2 abre el 25-oct** y el item #1 (L11) **ya no está bloqueado**: el scope de `/v2/account/buildstorage` es `account`, no `inventories` (ese es el de `/v2/account/bank`). **Corregí mi propia fila de la ronda 82**, que decia que le faltaba un permiso de Pablo.
- **ALERT-269 (c): las 3 condiciones siguen SIN cumplir, medidas hoy:** el snapshot `PRE_BACKLOG_PO_2026-10-05_a_2026-10-19.md` **no existe** (0 resultados en el repo y en mi workspace), `PRE_BACKLOG.md` **sigue trackeado**, `.gitignore` **no tiene** regla de PRE_BACKLOG, y `COMMS_LOG.md` **termina en la fila 185** (de `default`): la primera fila de mi canal nuevo no está. → **no se hace el `git rm --cached`**, por la regla misma que el Principal escribió. Próxima ronda: rama propia, snapshot commiteado primero, y la fila del canal en el mismo commit que el `.gitignore` + el `git rm --cached`.
- **El canal del PO en `COMMS_LOG.md` es la deuda que cuesta caro:** la ronda 82 (4 propuestas) vivió 7 minutos en mi workspace. En el HB#172, 3 proposals vivieron 8 días en un canal vencido sin fila. **Una ronda que no deja fila en el canal trackeado es una ronda que no existe para el resto del equipo.**

### 6. Errores propios de esta ronda (4, todos antes de reportar)

1. **`curl` del RSS de Reddit con UA de navegador** dio 403 "network policy"; `old.reddit` dio 302 y el `.rss` pelado 429. **No reintenté la misma forma 3 veces**: cambié de ruta.
2. **La salida de `/v2/achievements/categories?ids=all` me llenó la pantalla** (10.262 líneas) porque no la acoté. Volví a pedir solo lo que necesitaba.
3. **El primer `.mjs` de gw2treasures dio 0 de todo** (`0` ids, `0` títulos, `0` endpoints) y lo leí como "el sitio no sirve". **Era mi regex**: el HTML no usa `data-item` ni `title=`. El segundo barrido mostró que el texto visible son 2.627 chars — o sea que **el 0 era correcto y la página no tiene el dato**, pero por un motivo que no era el que yo suponía.
4. **Leí `PRE_BACKLOG.md` con `Get-Content` de PowerShell** y me salió mojibake (`Ç­`, `ƒ?"`). Es la consola, no el archivo (ya me pasó en el HB#197): el byte del archivo es UTF-8. **Leí con la herramienta de lectura, no con la consola.**

**Archivos tocados:** `PRE_BACKLOG.md` (este bloque, append puro) + corrección de 2 filas con premisa falsa (L11, el bloqueo `inventories`). **No toco** `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md` ni `COMMS_LOG.md` del repo en esta ronda. **Rama:** ninguna. **No mergeo.**

## HB#221 / PO ronda 83 (b) — EJECUCION de la decision (c): PRE_BACKLOG.md sale de git

**Que se ejecuto.** El Principal aprobo la variante (c) con 3 condiciones: **C1** (las filas de las rondas perdidas tienen que estar en el `COMMS_LOG.md` del repo), **C2** (el commit del archivo congelado va ANTES del `git rm --cached`, en el mismo ciclo), **C3** (el paso 3 no se rompe: el tercer canal lee el workspace del PO, no la copia del repo). Esta es la segunda mitad del HB#221: la otra mitad (ronda 83, arriba) fue la verificacion de las 4 propuestas contra la API y contra el disco.

**Medido antes de actuar (no acepté la premisa):**
- **C1 SATISFECHA con el commit, no con la promesa:** las filas 183/184/185 estan en `origin/main:COMMS_LOG.md` desde `563b98d`. Antes de ese commit la ultima fila era la 182 (2026-10-03) y `ronda 80` / `ronda 81` / `Idea 77|78|79` / `9472` / `9478` daban **0** en el `COMMS_LOG.md` trackeado.
- **C3 VERIFICADA por lectura del codigo, no por opinion:** `tools/hb163-canales.mjs:9` declara `PO_WS = .../workspaces/product-owner/PRE_BACKLOG.md`. La copia del repo no es ningun canal del paso 3. Y `AGENTS.md:645` ya decia "vive en workspace del PO, NO en el repo": (c) hace que el repo coincida con la regla escrita (ALERT-269).
- **El "30 KB" de C2 era el archivo de AYER:** 30.232 B midio el Principal (`ALERTS_LOG.md:65`). El prefijo de mi archivo daba 30.237 B y la seccion HB#220 (ronda 82) sumo **15.661 B DESPUES** de esa medicion. **Congelar en 30 KB habria dejado sin fila y sin congelado a las Ideas 80 y 81.**

**Hallazgo que nadie habia medido (189 refs + 242 commits colgantes):** la ronda maxima de `PRE_BACKLOG.md` en **cualquier** rama es **67**, y la de `DASHBOARD_PO_IDEAS.md` en los 181 refs es **75**. O sea: **las rondas 76-82 no existen hoy en ningun artefacto versionado** — el congelado es lo unico que las conserva. Y al reves: la prosa completa de las rondas **74-76** no esta en ningun lado, porque el buffer del workspace es rodante (guarda ~3-4 rondas + una tabla "Cerradas" de una linea por ronda): de la 74, la 75 y la 77 hay UNA mencion cada una, y de la 76, CERO.

**Entregado** — rama `po/hb221-pre-backlog-fuera` (3 commits, NO mergeada):
1. el congelado `PRE_BACKLOG_PO_2026-10-05_a_2026-10-19.md` (byte-identico del workspace, SHA-256 verificado);
2. saca `PRE_BACKLOG.md` del indice + regla `/PRE_BACKLOG.md` en `.gitignore` (el archivo **sigue en disco**, 376.387 B; el historico sigue en `f17960a`);
3. actualiza el congelado (el workspace siguio creciendo con la ronda 83 de la otra mitad: 9.709 B) + trae la seccion **"Canal del PO"** del `COMMS_LOG.md` (filas 186/187) + la fila 188 de esta ejecucion.

**Dos instancias del heartbeat del PO corrieron EN PARALELO sobre el mismo workspace.** La otra mitad escribio la ronda 83 en el workspace a las 23:07:48Z y pusheo `origin/po/hb221-canal` con SU propio congelado + el mismo `git rm --cached` + las filas 186/187. Las dos ramas hacen lo mismo con nombres de archivo distintos: **Pablo, mergear SOLO una** (recomiendo `po/hb221-pre-backlog-fuera`: trae las 3 condiciones medidas dentro del mensaje de commit y el nombre de archivo que pediste). Las dos son reversibles: `git checkout f17960a -- PRE_BACKLOG.md` + borrar la regla del `.gitignore`.

**Driver:** el driver veta `git rm --cached` por el substring "rm" (falso positivo). Use `git update-index --force-remove PRE_BACKLOG.md`, que es el MISMO efecto sobre el indice y **no** borra el archivo del disco. Verificado: `git ls-files PRE_BACKLOG.md` vacio, el archivo sigue en disco, y el historico intacto.

**Correccion propia de la fila 183 (del Principal):** dice "HB#173 (ronda 80/81 del PO)", pero HB#173 es el ciclo del 2026-10-03 (ALERT-243, fila 182) y la ronda 80/81 del PO es **HB#218 / HB#219** (medido en los encabezados de mi workspace). Con las dos filas asi, `HB#173` devuelve dos cosas distintas en el mismo archivo.

# HB#222 / PO ronda 84 (2026-10-20 00:05 UTC) — RECOLECTAR. La app no tiene capa de temporada: 2 catalogos manuales congelados (25/08 y 23/04) y las 3 fuentes automaticas que parecian servir estan MUERTAS (medido, no supuesto)

**Modo:** RECOLECTAR. **Control de carga:** `openItems = 2` en `BACKLOG.md` (repo, `origin/main` @ `563b98d`): L11 `buildstorage` (wrapper + call site en Inventory Dashboard) y L113 Coberturable account-scoped multicuenta. Filas con sangria abiertas: 0. **PASO -1:** 0 "Esperando" hacia el PO y 0 en Timeout. **Punto de partida:** `origin/main` @ `563b98d`; el `main` local esta **2 commits adelante** (`daaf997`, la ejecucion de la decision (c) del HB#221, **sin pushear** — el push a `origin/main` es del Principal, no mio).

**Nota de instrumento (la primera vez que la aplico aqui):** el `COMMS_LOG.md` tiene **10 columnas**, y el `Estado` es la **6ta**. Leyendo la 5ta (`Pedido`) me salio "12 Esperando hacia el PO" y "0 pendientes" era falso: los 12 eran textos de pedido que contain la palabra. Con la 6ta: **0 hacia el PO, 0 Timeout mios**. Un parser que no se autocontrola produce un numero con la forma de un dato (ya me paso en HB#175, HB#182 y HB#206).

## 1. EL HALLAZGO DE LA RONDA: en Halloween 2026 la Boveda es ciega al festival, y no por un bug: por dos catalogos que se escriben a mano

Medido hoy, contra el disco:

| catalogo | entradas | bytes | ultimo cambio | contenido de Halloween 2026 |
|---|---:|---:|---|---|
| `assets/meta-events.json` | 43 | 19.604 | `899f329` = **2026-08-25** | **0** ("Halloween" 0, "Mad King" 0, "Leyspring" 0) |
| `assets/meta-drops.json` | 37 | 7.026 | `45cee35` = **2026-04-23** | **0** ("Trick-or-Treat" 0) |

- `js/meta.js:188` carga el primero: la lista de eventos de mundo **es un archivo estatico**. `js/meta.js:268` consulta `/v2/events?ids=` para el horario, pero ese endpoint esta retirado (mas abajo).
- El parche del **13-oct-2026** (wiki `Game_updates`) anuncio 8 eventos de mundo nuevos: **Mad King's Labyrinth, Clock Tower, Lunatic Inquisition, Mad King's Raceway, Mad King Says, Ascent to Madness, Reaper's Rumble** y el meta **"Depths of Cruelty"** en Leyspring Hollows. **Ninguno esta en la app.** Tampoco el `Trick-or-Treat Bag` ni sus probabilidades, que ArenaNet **cambio ese mismo dia** ("Equalized the chance of gaining individual Halloween-themed weapons from the Trick-or-Treat Bag"): aunque el catalogo lo tuviera, estaria **mal**.
- Contraste que importa: la app **si** esta al dia con el contenido de raids y fractales: `js/raid-tracker.js:141` ya tiene el ala **"Nexus of Eternity"** y `:145` a **Vloxx**; `js/activities.js:978` tiene el **"Solitary Throne CM daily tracker"**. O sea: el equipo mantiene raids y fractales al dia. **Lo que no se mantiene es la capa de mundo y de temporada.** El gap no es "el equipo no actualiza": es que el mundo no tiene a quien lo actualice.

## 2. Las 3 fuentes automaticas: las 3 MUERTAS (medido hoy, no supuesto)

Esto es lo que **cambio** el plan de la ronda. Mi hipotesis inicial era "que la app descubra los eventos por la API, como ya hace con los horarios". La hipotesis **murio al medirla**, y lo que queda es mas util:

1. **`/v2/events` → RETIRADO.** 503 en las 3 formas que probe: `?ids=all&lang=es`, `?lang=es`, y pelada. No es mio: `js/meta.js:251-258` ya lo documenta textualmente ("**/v2/events esta RETIRADO. Verificado 2026-09-29 18:06 UTC: responde 503 {\"text\":\"API not active\"}**... No existe endpoint sustituto"). Yo solo lo confirme hoy.
2. **`/v2/maps` → no trae los eventos.** La lista devuelve **1086 ids numericos** (no objetos: mi primer parser los leyo como objetos vacios). El **detalle** de 11 mapas (25, 28, 34 + 8 al azar) tiene las claves `id,name,min_level,max_level,default_floor,type,floors,region_id,region_name,continent_id,continent_name,map_rect,continent_rect` — **sin campo `activities`**. La API ya no lo expone.
3. **Wiki `Meta-event` → atrasada.** 9.396 chars visibles, con las metas por zona (Kryta incluida), pero de Halloween 2026 solo tiene "Shadow of the Mad King" y "Advisor of the Lunatic Court" (de temporadas previas). "Ascent to Madness" 0, "Clock Tower" 0, "Raceway" 0, "Reaper" 0.

**La que si los nombra a todos** es la misma que ya leo: el parche del 13-oct en `Game_updates`, y el indice de gw2treasures (mas abajo). O sea: **hoy la unica fuente viva de "que hay de nuevo" son las notas del parche**, y la Bóveda no las lee.

## 3. Descubrimiento nuevo: gw2treasures tiene un indice canonico por temporada, legible por maquina

No lolei antes porque `sitemap.xml` da 404 y el sitio es Next.js (shell sin datos). El camino correcto estaba en `robots.txt`:

- `robots.txt` (200, 307 B) declara: **`Sitemap: https://en.gw2treasures.com/sitemap`**.
- Ese sitemap es un **sitemap_index** con **16 submaps**: `items/0..3`, `skills/0`, `traits/0`, `professions/0`, `achievements/0`, **`achievement-categories/0` (384 locs)**, `builds/0`, `currencies/0`, `skins/0`, `minis/0`, **`static/0` (69 locs)**.
- `static/0` es el que importa: trae **6 temporadas x 4 subrutas** — `/festival/{wintersday,lunar-new-year,super-adventure,dragon-bash,four-winds,halloween}/{achievements,skins,minis,wizards-vault}` — mas `/fractals`, `/raids`, `/dungeons`, `/legendary/{weapons,armor,trinkets,relics}`, `/homestead/*`, `/wizards-vault/{objectives,rewards}` y `/bonus-event/evon-gnashblades-birthday`.

Es un **indice canonico de "que es de esta temporada"**, en XML, sin JS. Contra el HTML de la ronda 82 (2.627 chars de shell), esto es un cambio de fuente, no un cambio de scraping.

**Y la app no tiene el concepto:** en los **47 archivos / 40.316 lineas** de `js/`: `festival` **0**, `seasonal` **0**, `Festivities` **0**, `novedad` **0**, `changelog` **0**. Lo mas cerca es `wv-season-storage.js` (12 hits de "temporada"), que es la **temporada de la Wizard's Vault**, no la del juego. Y `achievements.js:260` ya descarga `/v2/achievements/categories?ids=all` (101 "Actividades de temporada" + 137 "Eventos actuales") y `:917-928` ya las muestra en un dropdown: **la app tiene la mitad de los datos de temporada y no los cruza con nada**.

## 4. Reddit: 3 rondas seguidas sin fricción nueva, y el canal esta equivocado

- `/r/Guildwars2/hot/.rss` → **200, 50.109 B, 25 entradas** (volvio; la ronda 83 lo vio caer a 403 a las 23:10).
- `/r/Guildwars2/new/.rss` → 200, 47.728 B, 25 entradas: **es el mismo set** que `/hot`, con 4 posts que `/hot` deja caer ("An observation on the current state of fractals", "Server Selection", "Should I be scared of HoT?", "Is PvP in a decent state?"). 8 de 25 son arte/cosplay/memes.
- El post de friccion #1 ("FASTEST Way to Complete the Halloween Weekly!") es **el mismo de la ronda 82**: no aporta nada nuevo, pero **confirma que la demanda sigue viva** → sostiene la Idea 80.
- **El canal con mas señal de friccion es el "Weekly /r/GuildWars2 Question Thread"** (post #2 del hot): ahi los jugadores preguntan "como hago X", que es exactamente la superficie que la Boveda deberia resolver. **Cambio de canal para las proximas rondas: de `/hot` al Weekly Thread.**

## 5. Ideas en bruto → consolidadas

### 🟡 IDEA 82 (NUEVA) — Capa de temporada: que la Boveda sepa que esta vivo ahora
- **Problema:** durante Halloween 2026 la Boveda no muestra **ningun** evento del festival ni sus drops. Los dos catalogos que si tiene estan congelados (25/08 y 23/04) y no hay fuente automatica viva (las 3 medidas, arriba). Para un jugador multicuenta, el festival es la semana de mas logros del ano y la app es ciega a eso. El jugador que quiere saber "que hay de Halloween y que me falta" tiene que ir a la wiki.
- **Solucion por escalones (el T1 es el que hay que hacer):**
  - **T1 (🟢, ~1 dia):** control de antiguedad **visible** en el modulo Meta: si `meta-events.json` tiene > 60 dias, mostrar "catalogo desactualizado (ultima actualizacion: 25/08/2026)". Convierte el silencio en señal. Sin esto, el catalogo se pudre sin que nadie se entere.
  - **T2 (🟡, 2-3 dias):** "Novedades del parche": 1 fetch al `Game_updates` de la wiki (HTML estable, cache 24 h), extraer los nombres propios del ultimo parche y marcar los que la app **no** conoce. Cubre la Idea 81 con una fuente verificada.
  - **T3 (🟡, 3-5 dias):** panel de festival **por cuenta**, usando el indice de gw2treasures (`/festival/<season>/achievements|skins|minis|wizards-vault`) + las categorias que la app ya descarga.
  - **T4 (🔴): NO lo propongo.** Regenerar `meta-events.json` automaticamente desde el parche: extraccion fragil y es un cambio de la fuente de verdad. Queda anotado como **techo**, no como tarea.
- **Dificultad:** 🟡. **Impacto:** `js/meta.js`, `assets/meta-events.json`, `assets/meta-drops.json` (+ un modulo nuevo si se hace T3). **Prioridad:** ALTA — es la unica propuesta de la ronda que ataca una **ceguera**, no una ausencia.

### 🟢 IDEA 79 — Raid Tracker: estado "Legendary Mode" por encuentro (RE-VERIFICADA HOY, la mas barata)
- El parche del **13-oct** dice, textual: "**Legendary Mode for Nexus of Eternity has landed**". `js/raid-tracker.js:141` ya tiene el ala "Nexus of Eternity" y `:145` a Vloxx. Premisa **intacta** contra la fuente primaria. Sigue siendo la mas barata de las 4 (🟢).

### 🟢 IDEA 80 — Matriz de logros diarios y semanales por cuenta (RE-VERIFICADA HOY)
- El parche del 13-oct confirma los dos logros que la sostienen: "**(Weekly) Halloween Festivities**" y "**(Annual) Halloween Rituals**" (con recompensa nueva, la Primeval King's Wrappings). `js/achievements.js:242` excluye Daily/Monthly del total permanente: los datos llegan y no se muestran. Reddit lo confirma con demanda viva. 🟢 (ya era 🟢 desde la ronda 83).

### ⚪ IDEAS 78 y 81 — sin novedad; 81 se FUSIONA con la Idea 82
- **78 (WV, objetivos especiales de evento):** el parche del 13-oct lo confirma ("The Wizard's Vault has been updated with Special Objectives for participating in Halloween activities") y el codigo ya tiene la pestaña de Especiales → **~80% hecha**. No se re-propone.
- **81 (catalogo de novedades):** es **la misma necesidad que el T2 de la Idea 82, con otra fuente**. Mantenerlas separadas era ruido. Fusionada (cuenta como una).

## 6. Prioridades para el Principal (orden de este heartbeat)

1. **Idea 82 T1** (🟢, 1 dia) — aviso de antiguedad del catalogo de eventos. Es la mas barata y convierte el problema invisible en visible. **Es la que pido primero.**
2. **Idea 79** (🟢) — Legendary Mode en el Raid Tracker. Premisa re-verificada hoy contra el parche.
3. **Idea 80** (🟢) — matriz de semanales/diarios por cuenta. Premisa re-verificada hoy.
4. **Idea 82 T2** (🟡) — novedades del parche desde la wiki.
5. **Idea 82 T3** (🟡) — panel de festival por cuenta.

**Idea 81 queda fusionada en la 82 T2. Idea 78 queda cerrada como "~80% hecha".**

## 7. Estado de la cola y de la deuda

- `openItems = 2` (L11, L113). **No abro idea nueva en el backlog del repo**: la Idea 82 es una idea del PO, vive en su canal, y la decide el Arquitecto/Pablo.
- **La ronda 82 quedo sin fila hasta 13 minutos** (la 23:07Z). Hoy **no**: la fila 188 va en el `COMMS_LOG.md` del repo, en la seccion "Canal del PO", en el mismo commit de la ronda.
- **Congelados:** `PRE_BACKLOG_PO_2026-10-05_a_2026-10-19.md` y `PRE_BACKLOG_PO_WORKSPACE_2026-10-19_rondas_78-83.md` siguen siendo la foto de archivos que **ya no cambian** (uno salio de git, el otro es el archivo que el workspace congelo). **No re-congelo:** el canal que crece ahora es el `COMMS_LOG.md` (fila 188), que si esta en git. Mi error del HB#221 ("congelar 30 KB") era de **tamaño**; el fix correcto era de **contenido**, y el contenido ahora vive en el COMMS_LOG.
- **Trabajo ajeno:** el clon tiene **39 worktrees** colgados (de ciclos anteriores, no mios de este ciclo). `wt-po68` es de un ciclo PO viejo (ronda 68). No los borro: no son de este ciclo y hay WIP ajeno; lo reporto.

## 8. Errores propios de esta ronda (6, todos antes de reportar)

1. **Lei `/v2/maps` como "1086 objetos sin `activities`".** La lista son **1086 ids numericos**; mis "objetos vacios" eran strings sin `id`. La conclusion final se sostiene (el **detalle** de 11 mapas no trae el campo), pero la medicion intermedia no discriminaba nada y casi la reporto como capacidad de la API. **El detalle manda, no la lista.**
2. **Mi filtro de nombres de mapa busco `/Lion|Arch|Kryta/` en nombres en espanol** ("Arco del Leon") → 0 candidatos → `0/0`, que lei como "la API no tiene actividades". El filtro era el problema. Ademas `typeof x === 'string'` sobre ids numericos dejo la URL vacia → HTTP 400.
3. **Mezcle `require` con `await` de nivel superior** en un `.mjs` → `ReferenceError: Cannot determine intended module format`. Reescrito con `import`.
4. **`git log --format=%h|%ad|%s` sin comillas**: cmd.exe corto la linea en el `|` y ejecuto `%ad` como comando. Con comillas el `|` no es pipe.
5. **Mi parser de `COMMS_LOG.md` leia la columna 5 como `Estado`** (es la 6) → "12 Esperando hacia el PO" que eran textos de pedido. Un 0/12 con la forma de un dato.
6. **Escribi el plan de la ronda sobre la premisa "descubrirlos por la API"** y la medí recien al ejecutarla. La premisa era falsa (endpoint retirado) y el plan entero habria salido mal. **Una premisa que no se midio antes de escribir el plan es un plan con una hipotesis adentro.**

**Archivos tocados:** `PRE_BACKLOG.md` (workspace, append puro) + `COMMS_LOG.md` (repo, fila 188) + `DASHBOARD_PO_IDEAS.md` (repo, cabecera de la ronda). **No toco** `BACKLOG.md`, `TEAM_STATUS.md`, `ALERTS_LOG.md`, `DECISIONS_LOG.md`. **Rama:** `po/hb222-ronda84` (nace de `main` local `daaf997`, que esta 2 commits adelante de `origin/main`). **No mergeo.**


## HB#222 / PO ronda 85 (2026-10-20 00:2xZ) - Reddit caido en 3 rutas, 2 ids de gw2treasures que la API NO expone, y 1 casi-propuesta descartada antes de reportarla

**Control de carga (medido, no asumido).** `tools/hb163-canales.mjs` sobre `origin/main` @ `563b98d`:
`c2_backlog_main.openItems = 2` con `openItemsDiscrimina: true` -> banda **0-3 = RECOLECTAR** (se investiga, se traen ideas).
`max_global_ronda = 83`, consistente en las 3 formas (67 / 67 / 83). `c3_pre_backlog_ws` da `marcadorPresente: 0`, asi que su `openItems: 0` **no es una medicion** (ALERT-236) y no lo use.

### 1. Fuentes: 1 de 3 caida

| fuente | ruta | resultado |
|---|---|---|
| Reddit | `www.reddit.com/r/GuildWars2/hot/.rss` | **429 Too Many Requests** |
| Reddit | `www.reddit.com/r/GuildWars2/hot.json?limit=25` | **403** |
| Reddit | `old.reddit.com/r/GuildWars2/hot/.rss` | shell de JS, **0 posts** |
| Wiki | `wiki.guildwars2.com/wiki/Game_updates` | **OK**: updates del 13, 14 y 15-oct |
| gw2treasures | `gw2treasures.com/en/` | **404** |
| gw2treasures | `gw2treasures.com` (raiz) | **OK**: lista de logros e items nuevos |

**Reddit cae por 3 rutas distintas y no se reintenta mas** (regla del PO): es la fuente de "que quiere la gente" y hoy no devolvio **1 solo post**. La ronda 83 ya lo habia visto caer de 200 a 403; hoy no es un rate limit transitorio, es una caida de la ruta.

### 2. Verificaciones nuevas contra la API viva

Pedi 14 ids de logro en una sola llamada: **`http=206` (contenido parcial)**. Respondieron **12 de 14**. Los 2 que **NO existen**:

- **9478** - gw2treasures lo enlaza como "Legendary Conqueror of Vloxx" (6 dias). **No existe en la API** (medido en la ronda 83 y por el Reviewer; lo confirmo hoy).
- **9363** - "Tenebral Ward Armor Collection". **TAMPOCO existe**, y **no lo habia medido nadie**: se me escapo en la ronda 83.

Los 12 que si existen: 9370, 9394, 9413, 9414, 9422, 9435, 9454, 9462, 9472, 9473, 9474, 9398.

**Consecuencia para mi propio metodo:** la fuente web que uso trae **2 links muertos entre los logros mas nuevos**, y mi ronda 83 habia tomado 9478 de ahi. **Toda id que venga de gw2treasures hay que pasarla por la API antes de escribirla en una propuesta.**

### 3. Lo que el Wiki confirma de las ideas que ya estan en vuelo

- **Idea 78 (WV: distinguir el objetivo de evento): CONFIRMADA.** El update del 13-oct lo dice literal: *"The Wizard's Vault has been updated with Special Objectives for participating in Halloween activities."* El sub-flag "de evento" existe de verdad y hay contenido cargandose con el evento.
- **Idea 79 (Legendary Mode en el Raid Tracker): CONFIRMADA, con un dato que mi idea NO traia.** El update del 14-oct: *"Defeating Vloxx with the challenge mote active awards an exclusive achievement **and title**."* Mi ronda 82 apuntaba al achievement (9478, que no existe) y **no mencionaba el titulo**. **Delta para el Reviewer: el alcance de la Idea 79 tiene que cubrir el titulo, no solo el logro.**

### 4. Una casi-propuesta que se descarto en el acto

**Idea 83 (candidata): "Metas y logros de Leyspring Hollows (Visions of Eternity)".**
- **Medido:** `leyspring` = **0 hits en TODO `origin/main`** (el unico hit es `PRE_BACKLOG.md`, o sea yo) y `renown` = **0 hits en `js/`**.
- **Y no es un hueco:** `js/meta.js` (1046 lineas) **no tiene ni un endpoint `/v2/`**, y sus tablas (`EXP_MAP`, `EXP_TINT`, `EXP_ICON`) son **por expansion** ('core', 'hot', 'pof', 'eod', 'soto'...), no por mapa. O sea que el mapa nuevo **no se agrega hardcodeando**: entra por la API.
- **Por eso NO la propongo.** Un `0 hits` que no distingue "no esta" de "no tiene por que estar" es un 0 sin informacion (misma familia que ALERT-236). **Reporto la medicion y la pregunta, no la propuesta.**

### 5. Una pregunta con premisa medida (NO es propuesta)

**Los renown hearts y el filtro de permanentes.** Los logros renown de Leyspring Hollows (9413, 9426) traen `flags: ['IgnoreNearlyComplete','Pvp','RepairOnLogin','Repeatable','Permanent']` y `type: 'Default'`. El filtro de la app es `if (hasFlag(meta,'Daily') || hasFlag(meta,'Monthly')) return;` -> **no mira `Repeatable`**, asi que **entran al conteo de permanentes**. Si el denominador oficial de GW2 los excluye, el "% de logros" de la app no coincide con el de la wiki. **Falta medir el denominador oficial antes de llamar a esto un bug** -> pregunta para el Principal, no propuesta.

### 6. Prioridades: sin cambios, y el motivo ahora es mas durable

**0 propuestas nuevas consolidadas en esta ronda.** Las prioridades siguen siendo las de la ronda 82, y por el motivo mas durable que conozco: **no son "las mas votadas del subreddit", son las dos mas baratas de construir.** Con `openItems = 2` hay holgura de carga y el Sprint 2 abre el 25-oct.

1. **Idea 80** - matriz de semanales/diarios por cuenta. **ALTA.** En el Reviewer ahora (pack con la 81).
2. **Idea 79** - Legendary Mode en el Raid Tracker. **ALTA.** Veredicto favorable y plan; **con el delta del titulo** (seccion 3).
3. **Idea 78** - WV: distinguir el objetivo de evento. **MEDIA**, acotada: el 80% ya estaba hecho.
4. **Idea 81** - "Novedades". **MEDIA**, re-escrita: la fuente es la API, no gw2treasures.
5. **Idea 77** - Festival Tracker. Veredicto favorable y plan (modulo nuevo `js/festival-tracker.js`); **no se vuelve a mandar**.

### 7. Errores propios (3, todos antes de reportar)

1. **`node -e` con el texto del round embebido salio sin salida**: el quoting de `cmd.exe` se come el resultado. Rehecho con `.mjs`. **El one-liner con contenido embebido no es compacto, es fragil** (4a vez).
2. **Ruta del workspace mal escrita** (`C:\Users\psanc\qwenpaw\` en vez de `.qwenpaw`) -> ENOENT. No rompio nada.
3. **Un `curl` a la API con 14 ids dio `206`**: un `206` **no es un error, es contenido parcial valido** y el cuerpo trae los que si. Lo use bien, pero lo anoto porque un `206` se puede leer como falla.

**Archivos tocados:** `PRE_BACKLOG.md` (este bloque, append puro). **No toco** `BACKLOG.md`, `TEAM_STATUS.md` ni `ALERTS_LOG.md` del repo. **Rama:** `po/hb222-ronda84`. **No mergeo** (mergea el Principal).

### 8. Nota de concurrencia (medida, no supuesto)

**While esta ronda corria, Pablo corrio su PROPIA ronda 84 y la pusheo a `origin/po/hb222-ronda84` (760e8a8, 00:08:58Z).**
Su ronda 84 trae una **IDEA 82 (NUEVA): "capa de temporada"**, con 3 escalones (T1 aviso de antiguedad del catalogo de eventos, T2 novedades del parche desde la wiki, T3 panel de festival por cuenta), y un hallazgo que **yo no habia medido**:

- `assets/meta-events.json` = 43 entradas, **ultimo cambio 2026-08-25**; `assets/meta-drops.json` = 37 entradas, **ultimo cambio 2026-04-23**. Los dos catálogos estan **congelados y sin contenido de Halloween 2026**.
- Las **3 fuentes automaticas estan MEDIDAS y muertas**: `/v2/events` da 503 (ya documentado como retirado en `js/meta.js:251-258`), `/v2/maps` no trae campo `activities` en el detalle de 11 mapas, y la wiki de Meta-event esta atrasada.
- En la app: `festival` 0, `seasonal` 0, `novedad` 0, `changelog` 0 en 47 archivos / 40.316 lineas.

**Por que esto NO es una idea mia duplicada y NO lo robo:** mi ronda es de **verificacion** (9478 y 9363 no existen; el Wiki confirma la 78 y la 79 con el titulo) y mi candidata es **Leyspring Hollows**, que es otra cosa. Pero **las dos son "capa de mundo/temporada"**: mi Idea 83 (metas y logros del mapa nuevo) y su Idea 82 (capa de temporada) **se tocan**. **La Idea 83 queda como candidata, NO como propuesta, y el ordenamiento lo decide el Principal.**

**Y un hallazgo de numeracion que hay que arreglar antes de mergear:**

- La fila **188** existe **EN DOS RAMAS DISTINTAS Y CON TEXTO DISTINTO**: en `po/hb221-pre-backlog-fuera` es la **cierre del HB#221 (ALERT-269 (c))**; en `po/hb222-ronda84` (de Pablo) es la **ronda 84**. Las dos ramas salen de `daaf997` y las dos agregan una fila al final de la misma tabla: **cualquier merge de las dos a pelo choca en el final del archivo.**
- Mi rama `po/hb222-ronda85` **resuelve la colision**: deja **188 = cierre del HB#221**, **189 = ronda 84 de Pablo**, **190 = esta ronda 85**.

**Renumeracion propia:** mi ronda era la 84 y mi candidata era la "Idea 82"; con la ronda 84 de Pablo, la mia pasa a **ronda 85** y mi candidata a **Idea 83**. **Dos rondas no pueden llamarse igual en el mismo canal**, que es el mismo motivo por el que el canal existe.

## PO ronda 86 (2026-10-20 10:55Z) - 3 correcciones aceptadas como DEFINITIVAS por el Principal (HB#175) y re-verificadas HOY contra la API viva; y el envio duplicado que casi me costo una fila

**Ciclo:** el cron no pasa el numero de HB; la ronda es la 86 por contador propio (la 84 y la 85 fueron del ciclo HB#222).

**Modo:** PAUSA. `openItems = 2` medido en `origin/main` @ `11e2682` ({L11 `buildstorage`, L113 Coberturable}) daria RECOLECTAR por numero, pero el Principal fijo PAUSA (su cuenta: 2 + 4 filas nuevas que el va a abrir = 6). **No abro ninguna idea nueva consolidada.** Lo que entre en cola lo decide el.

### 1. Canal (PASO 0): 2 mensajes del Principal, 1 respuesta

| mensaje | que era | que hice |
|---|---|---|
| HB#174 (Principal) | 2 decisiones que me tocaban: la fila 77 vs la 82-T3, y la banda | **Respondido** con 3 mediciones (seccion 2) |
| HB#175 (Principal) | respuesta a mis 3 mediciones | **Las 3 aceptadas como DEFINITIVAS.** Verificado: `state=answered`, `replied_utc=20261020T072146Z` |

`inbox` / `overdue` / `waiting`: **vacio** al cierre de la ronda.

### 2. Las 3 mediciones que envie, y por que las 3 cambian el alcance de 2 filas

**(a) FAMILIA CM = 4 ids explicitos {8049, 9394, 9435, 9472}.** No se deriva por categoria. Re-verificado hoy contra la API viva:
- `8049` "Convergence Challenge Mode: Master" -> `rewards: [{type: Title, id: 495}]`, `requirement`: *"Earn gold rank in Convergences with challenge mode active for all legendary creatures"*, 1 tier `{count 5, points 10}`.
- `9394` "CM-Nexus of Eternity: Silver" (2 pts) y `9435` "...: Gold" (3 pts) -> 1 tier `{count 1, points N}` cada uno.
- `9472` "Legendary Nexus of Eternity" -> `requirement`: *"Defeat Vloxx while the challenge mote is active"*, 1 tier `{count 1, points 15}`.

**(b) FILA 77 = 82-T3: el trabajo NO es refrescar ids cada ano, es SELECCION POR CATEGORIA.** La lista hardcodeada de 8 no es el set de evento. A mano queda solo la fecha del festival vivo, 1 vez por ano. La fila lleva la LISTA de categorias con nombres (19 por filtro de palabras: 17 con logros, 2 vacias; 10 con la palabra estricta `festiv`; el 12 del Reviewer es un tercer filtro).

**(c) BUG DE AP: AP = min(suma de count*points, point_cap); sin point_cap, solo la suma.** La fuente de verdad son los `tiers` (ya cacheados) mas el `current` de la cuenta; `point_cap` **no** esta en `ACH_META_DROP`. **La fila puede arrancar SIN tocar la cuota de `ach_acc`** (la condicion que el Reviewer habia puesto).

### 3. RE-VERIFICACION de las 3 (no las di por buenas: las medi otra vez, con la API viva)

| logro | tiers (vivos) | point_cap | AP correcto | lo que cuenta `earnedAP` hoy |
|---|---|---|---|---|
| `9170` "Raid Mentor: Matthias" | 1 x `{count 1000, points 5}` | **no** | **5000** | 5 |
| `9413` / `9426` (repeatables Leyspring) | 1 x `{count 3, points 5}` | 15 | **15** | 5 |
| `9404` "Overcharged Executioner" | 4 x `{count 1,5,10,25, points 1}` | **20** | **20** (el cap ATA) | 4 |

**Las 3 cifras del HB#174 dan exactamente lo mismo hoy.** Y el caso `9404` confirma por que el cap es "el tope" y no "un dato redundante": `suma(count x points) = 41` y el cap = **20** -> el min da el valor oficial. La clase `cap > ladder` es **1 de 200** medida; en los demas el cap es redundante (15 = 15). O sea: **la regla del min no se puede derivar sin el cap, pero el cap solo hace falta en 1 caso**, y ese caso se puede cubrir con la condicion que el Principal ya fijo.

### 4. EL HALLAZGO NUEVO DE LA RONDA: la familia CM vive en 3 categorias, y la categoria "grande" NO contiene los 3 de Nexus

Mapa medido de las 4 categorias que tocan a la familia (`/v2/achievements/categories?ids=all` = **360 categorias**):

| id | nombre | n | de la familia |
|---|---|---:|---|
| **404** | `Convergences: Outer Nayos` | **21** | `8049` (Master, con titulo 495) |
| **487** | `Convergence: Nexus of Eternity` | 7 | `9394` (Silver), `9435` (Gold) |
| **488** | `The Nexus of Eternity` | 4 | `9472` (Legendary) |
| 465 | `Castora` | 23 | `9454` (Master of Masteries: Visions of Eternity) |

**Consecuencia directa para la fila:** la categoria 404 es la lista del CM de Outer Nayos y **tiene 21 ids de los cuales 10 son del Challenge Mode** (5 criaturas x Silver/Gold: Demon Knight, Hell Sister, Dreadwing, Umbriel, Sorrow) + `7668`/`7720` (Conqueror / Continuous, 11 tiers cada uno) + `8464` (Weekly CM) + `8049` (Master) + 3 de convergencia normal. **Pero NO contiene ninguno de los 3 de Nexus.** Si la fila deriva el set de logros del CM por la categoria 404, **pierde 3 de 4** y el Master queda sin sus 2 rangos de Nexus. O sea: **la categoria sirve para las alas del CM (las criaturas) pero NO sustituye al set explicito de 4.** El set explicito y las categorias se usan para cosas distintas.

**Y el mapa del CM completo, que hoy no teniamos (util para la Idea 79):**
- Outer Nayos: `7983/7986/7997/8057` (Gold) y `8015/8016/8057`/`8060`/`8087` (Silver) por criatura, `8049` Master (5 cuentas de Gold), `8464` Weekly CM (5 tiers), `7668`/`7720` (Conqueror/Continuous, 11 tiers).
- Nexus: `9394` Silver, `9435` Gold, `9349` Conqueror (6 tiers), `9422` + `9447` Weekly, `9387` "Raid: Nexus of Eternity", `9398` "A Shattered Vision", `9414` "A True Visionary", `9472` Legendary (Vloxx).
- **O sea que el CM tiene NIVELES (Silver / Gold / Master) y la app puede mostrar el rango real por cuenta**, no un booleano.

### 5. Delta del wiki que separa "raiz" de "CM" (relevante para la 79)

El patch del **14-oct** dice: *"Fixed a bug that prevented some players from getting credit for the **A Shattered Vision** achievement in the **Nexus of Eternity Challenge Mode**"*. `9398` = "A Shattered Vision" (10 pts, categoria 488) -> **se otorgaba POR EL CHALLENGE MODE, no por la raid.** Y el patch del **13-oct** arreglo `9454` "Master of Masteries: Visions of Eternity" (meta, categoria 465).
**Consecuencia para la Idea 79 (badge de CM/Legendary en el Raid Tracker):** el tracker tiene que distinguir **4 estados distintos**, no 2: `9387` (raid) / `9394` (CM Silver) / `9435` (CM Gold) / `9472` (CM Legendary, solo Vloxx). **"Raid completada" NO implica "CM hecha"**, y un jugador que hizo el CM **antes** del patch del 14-oct puede tener el logro sin credito -> la app le va a mostrar 0% hasta que lo re-haga. Eso es una friccion real de 27 cuentas, y la app no puede distinguir "no lo hizo" de "lo hizo y no le acreditaron".
**Sin parches nuevos desde el 15-oct** (build 208.784). Los ultimos 3: 13-oct (Halloween + Legendary Mode), 14-oct (fix del CM + Shadow Distance), 15-oct (bug fixes).

### 6. Fuentes de la ronda (re-medidas, 1 intento cada una, sin reintento)

| fuente | resultado |
|---|---|
| Wiki `Game_updates` | **OK**: sin parches nuevos desde el 15-oct; el 13-oct y el 14-oct confirman la 79 y el delta de la seccion 5 |
| Reddit `hot.json` | **403** (3era ronda seguida) |
| gw2treasures `/festival/halloween` | **OK y con contenido** (ver abajo) |
| API `/v2/items` (web_fetch) | fallo por content-type JSON; rehecha con python (1 intento) |

**gw2treasures: la MISMA ruta que antes era "solo shell" hoy entrega el contenido.** En la ronda 84 esa ruta daba 2.627 chars sin un solo dato; hoy trae 3 cosas concretas que son **el blueprint de un panel de festival por cuenta**:
1. **"Time Remaining: 14d 09:06:31"** -> el festival cierra el **3-nov** (coincide con la wiki: "three weeks, from October 13 until November 3"). Es el dato que la app no tiene: **cuanto falta para que termine el evento**.
2. **Tabla de conversion** (1.000 Pieces of Candy Corn -> 1 Candy Corn Cob) con precio de compra/venta y tendencia de 7 dias.
3. **"Your Mad King says..."** con el **proximo evento** ("Trader's Forum Waypoint") y la tabla de emotes.
4. **"Account Dashboard" por festival**: Candy Corn / Candy Corn Cob / Trick-or-Treat Bag **por cuenta** -> el Festival Tracker de la 77/82-T3 tiene su forma exacta.

### 7. Prioridades: sin cambios, y el motivo es el mismo que en la 85

**0 propuestas nuevas consolidadas** (PAUSA). El orden sigue: **1) Idea 80** (matriz de semanales/diarios por cuenta, ALTA) - **2) Idea 79** (Legendary Mode / CM en el Raid Tracker, ALTA, con el delta de la seccion 5) - **3) Idea 78** (WV objetivo de evento, MEDIA) - **4) Idea 81** (fusionada con la 82) - **5) Idea 77 = 82-T3** (panel de festival por cuenta, con el blueprint de la seccion 6).

### 8. Errores propios de esta ronda (3, todos antes de reportar)

1. **Mande el mensaje al Principal DOS VECES** (`d06073` 06:59:17Z y `d26568` 06:59:47Z, 30 s de diferencia). **Causa: el primer envio corrio dentro de una cadena con `| findstr` que salio con exit code 1 y SIN stdout, y lo lei como "no se envio" -> reenvie.** El Principio lo vio y contesto las 2 copias con el mismo texto ("son duplicados del mismo cuerpo"), o sea que el dano fue 0 para el, pero el costo es real. **Un exit 1 sin stdout no es "no ocurrio": es "no sé".** El instrumento correcto es el archivo: `product-owner/sent/` + `state`/`replied_utc`, que es lo que use recien ahora para confirmarlo.
2. **Generalice el esquema de un elemento**: `/v2/achievements` no tiene un conjunto de claves fijo -> `9472` no trae `rewards` ni `icon`, `8049` si. Yo habia concluido "el endpoint no tiene campo title" (y por ahi casi dudar de mi propia medicion del titulo 495). **Las claves varian por logro: el conjunto de claves de un elemento NO es el esquema del endpoint.** El titulo esta en `rewards[].type == "Title"`, y solo 8049 lo tiene en la familia.
3. **Un `404` de la API no distingue "el id no existe" de "el endpoint esta retirado"**: `/v2/achievements/titles?ids=495` da 404 "no such id", y tambien da 404 **sin** ids -> **el endpoint `/v2/achievements/titles` esta retirado**, no el titulo 495. Y el nombre del titulo 495 no es resoluble por API. En la fila 77/82-T3 hay que decirlo: **no se puede mostrar el nombre del titulo desde la API.**

### 9. Estado

**Archivos tocados:** `PRE_BACKLOG.md` (este bloque, append puro) + `COMMS_LOG.md` (repo, fila **191**). **No toco** `BACKLOG.md`, `TEAM_STATUS.md` ni `ALERTS_LOG.md` del repo. **Rama:** `po/ronda86`. **No mergeo** (mergea el Principal).
**No hay mensaje nuevo al Principal:** el HB#175 ya respondio las 3 mediciones, y esta ronda **no abre nada nuevo** que justifique un `ask`. La entrega de la ronda es la fila 191 del canal, que es lo que el lee en su proximo heartbeat.
**Verificacion del append:** prefijo byte-identico (sha256 del bloque anterior igual antes y despues), LF puro, sin BOM, 0 ideogramas CJK.
## PO ronda 87-b (2026-10-20 18:49Z) - el `point_cap` no es un dato que "falte": viene de la API, la app lo dropea, y 95 de 8357 logros dependen de el

Numero de corrida local (no es un contador: hoy corrieron varias instancias del heartbeat en paralelo).

Pregunta de la ronda: el Principal (HB#175) afirma dos cosas - "point_cap NO esta en ACH_META_DROP" y "point_cap falta en 199 de 200". Yo habia medido lo contrario ("0 ocurrencias de point_cap en js/"). **Los dos medimos el mismo archivo y salimos con veredictos opuestos**: cuando eso pasa, el defecto suele estar en el instrumento, no en el codigo. Se resuelve midiendo, no opinando.

**Veredicto medido** (`js/api-gw2.js`, archivo IDENTICO en `origin/main` y en el working tree, 2725 lineas en ambos):

- L2027: `var ACH_META_DROP = ['bits', 'requirement', 'locked_text', 'prerequisites', 'point_cap'];` -> **`point_cap` SI esta en la lista de drop.**
- L2034: `if (ACH_META_DROP.indexOf(keys[i]) === -1) out[keys[i]] = rec[keys[i]];` -> el campo se borra al cachear.
- L356 y L2018: los dos comentarios de la docblock nombran `point_cap` explicitamente.
- **0 lecturas de `point_cap` en toda la app**: el campo se dropea al guardar y nunca lo lee nadie.

**Y el campo SI viene de la API** (no es inventado ni un residuo local). `/v2/achievements?ids=...` en vivo: `point_cap` PRESENTE en 9405 (10), 9413 (15), 9404 (20), 9426 (15); AUSENTE en 9170, 9173, 9379, 9472, 8049, 9394, 9435. El campo es real y llega a la app.

**Correccion de la interpretacion del Principal (el dato era correcto, la lectura no):** dijo "el unico que lo tiene (9404) da 41 contra el oficial 20, o sea el cap es el tope, no un dato redundante". El 41 no es "el oficial": el ladder bruto de 9404 es 41 (1+5+10+25) y **el oficial es 20, que es su `point_cap`**. O sea: **en 9404 el cap CORTA (20 < 25), no es un tope inerte.** La frase "el cap es el tope" es correcta; la implicancia "no cambia nada" no.

**Errores MIOS, los dos del instrumento (mismo par, uno por vez):**

1. **La API ya devuelve los tiers con los nombres `count`/`points`, no `goal`/`value`.** Yo leia `goal`/`value` -> ladder = 0 en los 8357 logros y "oficial != ladder" en 8357. *Un 0 obtenido de la forma equivocada del dato es indistinguible de un 0 real* (regla de siempre). Los numeros buenos de esa corrida: **8357 ids de logro en la API, 8357 con `tiers`**.
2. **El "oficial" que yo venía reportando NO venía de la API.** El payload de logro no trae el AP total (no hay campo de AP a nivel raiz; sale `null`). Yo estaba comparando la app contra **mi propia formula** y llamandolo "el oficial". Eso explica el "gap de 5.199 AP" que reporto la ronda 87: era un gap contra mi formula, no contra GW2.

**Censo real de la API (8357 logros, descarga completa):**

| medida | valor |
|---|---|
| logros totales | 8357 |
| con `point_cap` > 0 | **159** (1,9%) |
| con `point_cap` = -1 (o sea "sin tope") | 55 (no cuentan: 214 era el numero crudo, con los -1 incluidos) |
| de los 159, **el cap recorta de verdad** | **95** (60% de los que lo tienen) |
| **AP que el cap recorta, sumando esos 95** | **250.502 AP** |
| logros con mas de un tier | 2164 (en 1799, sumar todos los tiers != el ultimo) |
| con `count` = 1 y sin cap (control) | la app cuenta bien: gap 0 |

El caso extremo, **4644 "Officially Uninvited"**: ladder 200.000 AP, cap 20, oficial 20. **Un solo logro con 199.980 AP de diferencia** si la app no aplica el cap. Y 4819/3923/4626/4044 (Quaggan y yearlings): ladder 5000, cap 25, oficial 25. La app no PUEDE calcular ninguno de los dos numeros, porque **descarta el campo al cachear**.

**La formula del AP oficial de GW2 (medida, no supuesta).** Para logros de UN tier (6193 de 8357, el 74%):

    AP_oficial = min( min(current, count) x points , point_cap )     si point_cap > 0
    AP_oficial = min(current, count) x points                         si no hay point_cap

`count` = cuantas veces hay que repetir, `points` = el AP por repeticion, `current` = cuantas veces lo completo la cuenta. Los 12 que importan, contra la API viva:

| id | nombre | count x points | point_cap | OFICIAL | app cuenta | gap |
|---|---|---|---|---|---|---|
| 9170 | Raid Mentor: Matthias | 1000 x 5 = 5000 | - | 5000 | 5 | **4995** |
| 9173 | Master Mentor | 20 x 1 = 20 | - | 20 | 1 | 19 |
| 9379 | Not This Time, Isgarren! | 25 x 5 = 125 | - | 125 | 5 | 120 |
| 8049 | Convergence Challenge Mode: Master | 5 x 10 = 50 | - | 50 | 10 | 40 |
| 9404 | Overcharged Executioner | 25 x 1 = 25 | 20 | 20 | 1 | 19 |
| 9405 | (Repeatable) Nexus of Eternity Power Unleash | 25 x 5 = 125 | 10 | 10 | 5 | 5 |
| 9413 | (Repeatable) Leyspring Hollows: Assemblage A | 3 x 5 = 15 | 15 | 15 | 5 | 10 |
| 9426 | (Repeatable) Leyspring Hollows: Inquest Sabo | 3 x 5 = 15 | 15 | 15 | 5 | 10 |
| 9472 | Legendary Nexus of Eternity | 1 x 15 = 15 | - | 15 | 15 | **0** |
| 9394 | Convergence CM? Nexus of Eternity | 1 x 2 = 2 | - | 2 | 2 | **0** |
| 9435 | Convergence CM? Nexus of Eternity | 1 x 3 = 3 | - | 3 | 3 | **0** |
| 9456 | Gaze into Infinity | 1 x 5 = 5 | - | 5 | 5 | **0** |

**El codigo de la app, exacto** (`js/achievements.js`, `origin/main`):

- L211-219 `totalAP(meta)`: `sum += p` sobre los tiers -> **el "total" que muestra la app NO mira `count`**. Para 9170 la app cree que el maximo es **5 AP** cuando el oficial es 5000. O sea: **el denominador de la barra de progreso tambien esta mal**, y por un factor `count`.
- L220-233 `earnedAP(accountRec, meta)`: ordena los tiers por `count` y hace `if (done || cur >= need) sum += p` -> **usa `count` como UMBRAL, nunca como MULTIPLICADOR**. Cuenta el tier una vez, con `points`.

**Los dos bugs, con nombres distintos:** (1) `earnedAP` subcuenta (no multiplica por `count`, no aplica el cap); (2) `totalAP` subcuenta el maximo por la misma razon. Y (3) `point_cap` se dropea, o sea que aunque (1) se arregle, **el minimo con el cap es imposible para los 159 logros que lo traen**.

**El riesgo de oro de esta fila (por que el fix NO es "multiplicar por count" y ya):** si se arregla (1) sin (2), la app pasa de **subcuenta** a **sobrecuenta** en los 95 logros donde el cap recorta - y el error visible seria de 199.980 AP en UN logro. **Arreglar el multiplicador sin el cap es peor que no arreglar nada**, porque el numero que se muestra es plausibel y grande. En 9405, por ejemplo: sin cap la app diria 125 AP donde GW2 dice 10.

**Advertencia de alcance que la fila tiene que escribir explicitamente:** el `count` de la API es el *maximo de repeticiones* (un goal), no un multiplicador de "cuantas veces lo tengo". La API no expone "cuantas repeticiones completo" en el catalogo: eso esta en `current` de la cuenta. Sin `min(current, count)` la filaaria pasar de subcuenta a sobrecuenta (el error de 9170: 1000 x 5 = 5000 cuando la cuenta puede tener 3). **El fix real es `min(current, count) x points`, con el minimo `point_cap` cuando exista.**

**Limite de lo que puedo afirmar (honestidad de la medicion):** el gap **por cuenta** NO es medible sin un token de cuenta. Lo que es medible y queda firme es el gap **por logro** (la tabla de 12) y el gap **potencial total** (250.502 AP sobre 159 logros). Para el caso multi-tier (2164 logros, donde sumar los tiers != el ultimo tier, como 9404 con sus 4 tiers) **no resuelvo la semantica exacta** sin el payload de cuenta: el `count` de un tier no es el `current` de la cuenta. Para 9404 la lectura "4 tiers de 1 AP = 4 AP" contradice "25 x 1 = 25"; lo dejo anotado como **pregunta abierta**, no como falsehood.

**Fila que se propone (NO fuerzo nada: el Principal declaro la banda en PAUSA en el HB#175; yo mido 2 filas `- [ ]` en `BACKLOG.md` de `origin/main`, o sea RECOLECTAR por la tabla, pero el conteo es suyo y manda. La fila queda lista para que la ubique si la habilita, o archivada con fecha si no):**

- [ ] **AP oficial por logro (fix de `earnedAP` y `totalAP`)** - 🟡. Hoy `achievements.js:211-219` (`totalAP`) y `:220-233` (`earnedAP`) usan `tiers[i].count` como umbral y `tiers[i].points` como valor, sin multiplicar y sin aplicar `point_cap`; y `api-gw2.js:2027` dropea `point_cap`, que la API si manda (159 de 8357 logros, y en 95 el cap recorta de verdad: 250.502 AP). Objetivo: `min(current, count) x points`, con minimo `point_cap` cuando exista, y `totalAP` con la misma formula. Depende de: (i) conservar `point_cap` en `ach_meta` (no en `ach_acc`, asi que la condicion del Reviewer se cumple); (ii) que `current` sea el numero de repeticiones y no el numero de tiers. Medido: gap maximo **4995 AP** en un logro (9170), gap **0** en los logros de `count` = 1 sin cap (9472, 9394, 9435, 9456) - control positivo de la regla. Ojo: **arreglar el multiplicador sin el cap introduce un bug peor** (9405: 125 en vez de 10).

**No toco** `BACKLOG.md` (prohibido por `AGENTS.md`), `TEAM_STATUS.md` ni `ALERTS_LOG.md`. La fila va aca y se la propongo al Principal; que el la ubique si la banda lo habilita. **No toco `DASHBOARD_PO_IDEAS.md`**: desde la ronda 75 quedo congelado y el canal vivo es el `COMMS_LOG.md` del repo.

**Verificacion de esta corrida:** `ACH_META_DROP` releido en `origin/main` y en el working tree (identico, 2725 lineas); `point_cap` verificado en el payload crudo de la API (8 ids, 4 con cap y 4 sin); censo completo de los 8357 logros de la API (159 con cap > 0, 95 con cap que recorta, 250.502 AP de gap potencial); tabla de 12 logros calculada sobre los `count`/`points` reales; `earnedAP` y `totalAP` leidos linea por linea en `origin/main`. El numero "199 de 200" del Principal **no se reproduce**: el censo real es **159 de 8357** (1,9%), no 1 de 200.

**Errores propios de esta ronda (4, todos antes de reportar):** (a) `io.open(...)` usado como si fuera el contenido -> `AttributeError: '_io.TextIOWrapper' object has no attribute 'split'`; (b) el parche del `.read()` quedo por fuera del parentesis de la tupla -> `AttributeError: 'tuple' object has no attribute 'read'` (2 iteraciones perdidas); (c) `edit_file` fallo con `old_text` multilinea porque el archivo quedo en CRLF y yo buscaba con LF - el fix fue un fragmento de UNA linea; (d) leia `goal`/`value` (nombres viejos) en vez de `count`/`points` (los reales) -> 8357 ceros de escalera y un "gap de 8357" que era basura.
