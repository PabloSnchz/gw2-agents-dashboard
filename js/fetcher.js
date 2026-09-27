/**
 * js/fetcher.js
 * Fetcher de archivos .md desde raw.githubusercontent.com.
 * Incluye cache en memoria (diaria) y manejo de errores (404, network, invalid).
 */

// Error types
class FileNotFoundError extends Error {
    constructor(filename) {
        super(`Archivo no encontrado: ${filename}`);
        this.name = 'FileNotFoundError';
    }
}

class NetworkError extends Error {
    constructor(filename, status) {
        super(`Error al cargar ${filename} (status ${status})`);
        this.name = 'NetworkError';
    }
}

class MarkdownFetcher {
    constructor(config) {
        this.config = config;
        this.cache = new Map(); // cache diaria por filename
    }

    /**
     * Fetch un archivo .md.
     * @param {string} filename - nombre del archivo
     * @param {boolean} force - forzar refresh (ignora cache)
     * @returns {Promise<{success:boolean, content:string|null, filename:string, error:string|null}>}
     */
    async fetchFile(filename, force = false) {
        const url = this.config.getUrl(filename);
        const cacheKey = filename;
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (anti rate-limit)

        // Cache check con TTL (salvo force)
        if (!force && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(url);

            if (response.status === 404) {
                throw new FileNotFoundError(filename);
            }

            if (!response.ok) {
                throw new NetworkError(filename, response.status);
            }

            const text = await response.text();
            const result = {
                success: true,
                content: text,
                filename,
                error: null
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
            // Errores de red (CORS, DNS, etc.)
            if (error instanceof FileNotFoundError || error instanceof NetworkError) {
                return { success: false, content: null, filename, error: error.message };
            }
            return {
                success: false,
                content: null,
                filename,
                error: 'Error de red: verificá conectividad'
            };
        }
    }

    /**
     * Fetch todos los archivos configurados.
     * @param {boolean} force - forzar refresh
     * @param {Array|null} fileList - lista de archivos a usar (auto-detectada via API)
     *     Si es null, usa config.files (fallback hardcodeado)
     * @returns {Promise<Array>} resultados con metadata de zona y label
     */
    async fetchAll(force = false, fileList = null) {
        // Opción C' — Merge: archivos descubiertos via API + fallback hardcodeado.
        // Si la API devuelve archivos, usamos esos. Pero también garantizamos
        // que los archivos hardcodeados (BACKLOG.md, TEAM_STATUS.md, etc.)
        // siempre estén presentes, incluso si la API no los descubrió.
        const seen = new Set();
        const merged = [];

        if (fileList && Array.isArray(fileList)) {
            for (const f of fileList) {
                if (f.name) {
                    seen.add(f.name);
                    merged.push(f);
                }
            }
        }

        // Agregar hardcodeados no descubiertos por la API
        for (const f of this.config.files) {
            if (!seen.has(f.name)) {
                merged.push({ name: f.name, zone: f.zone, label: f.label });
            }
        }

        // Fetch paralelo (Promise.all) — fetchFile nunca rechaza, siempre retorna {success, ...}
        const promises = merged.map(file => this.fetchFile(file.name, force));
        const settled = await Promise.all(promises);
        return settled.map((result, i) => ({
            ...result,
            zone: merged[i].zone,
            label: merged[i].label
        }));
    }

    /**
     * Opción C' — Auto-detecta archivos .md en el repo vía GitHub Contents API.
     * Si la API falla (rate limit, network, etc.), retorna null para usar fallback.
     */
    async fetchFileList() {
        const url = this.config.getApiUrl();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('API ' + response.status);
            const items = await response.json();

            const mdFiles = items
                .filter(item => item.name && item.name.endsWith('.md'))
                .map(item => ({
                    name: item.name,
                    zone: this.config.getZoneForFile(item.name),
                    label: this.config.getLabelForFile(item.name)
                }));

            return mdFiles.length > 0 ? mdFiles : null;
        } catch (error) {
            return null; // fallback a config.files
        }
    }
}
