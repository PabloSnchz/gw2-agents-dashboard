/**
 * js/fetcher.js
 * Fetcher de archivos .md desde raw.githubusercontent.com.
 * Incluye cache en memoria (diaria) y manejo de errores (404, network, invalid).
 * + Cache persistente en localStorage para las API calls de api.github.com.
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
     */
    async fetchFile(filename, force = false) {
        const url = this.config.getUrl(filename);
        const cacheKey = filename;
        const CACHE_TTL = 5 * 60 * 1000;

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
            const result = { success: true, content: text, filename, error: null };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;

        } catch (error) {
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
     */
    async fetchAll(force = false, fileList = null) {
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

        for (const f of this.config.files) {
            if (!seen.has(f.name)) {
                merged.push({ name: f.name, zone: f.zone, label: f.label });
            }
        }

        const promises = merged.map(file => this.fetchFile(file.name, force));
        const settled = await Promise.all(promises);
        return settled.map((result, i) => ({
            ...result,
            zone: merged[i].zone,
            label: merged[i].label
        }));
    }

    /**
     * Lee del caché persistente (localStorage) si está dentro del TTL.
     * Retorna el caché aunque esté expirado si hay un error (fallback).
     */
    _readLocalCache(key, ttl, allowExpired = false) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.timestamp !== 'number') return null;
            const age = Date.now() - parsed.timestamp;
            if (age < ttl || allowExpired) {
                return parsed;
            }
            return null;
        } catch (e) {
            console.warn('[fetcher] Cache read error:', e.message);
            return null;
        }
    }

    /**
     * Escribe en el caché persistente.
     */
    _writeLocalCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            console.warn('[fetcher] Cache write error:', e.message);
        }
    }

    /**
     * Opción C' — Auto-detecta archivos .md vía GitHub Contents API.
     * Con caché persistente de 60 min + fallback a caché expirado.
     */
    async fetchFileList() {
        const CACHE_KEY = 'gn:dashboard:api:filelist';
        const CACHE_TTL = 60 * 60 * 1000; // 1 hora
        const url = this.config.getApiUrl();

        // 1) Intentar caché fresco
        const freshCache = this._readLocalCache(CACHE_KEY, CACHE_TTL);
        if (freshCache) {
            return freshCache.data;
        }

        // 2) Fetch real
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

            const result = mdFiles.length > 0 ? mdFiles : null;
            this._writeLocalCache(CACHE_KEY, result);
            return result;

        } catch (error) {
            // 3) Fallback: caché expirado
            const expired = this._readLocalCache(CACHE_KEY, CACHE_TTL, true);
            if (expired) {
                console.warn('[fetcher] API error, usando caché expirado de fileList');
                return expired.data;
            }
            console.warn('[fetcher] No cache disponible, usando fallback hardcodeado');
            return null;
        }
    }

    /**
     * Fetch de commits de GitHub API.
     * Con caché persistente de 60 min + fallback a caché expirado.
     */
    async fetchCommits(limit = 50) {
        const CACHE_KEY = 'gn:dashboard:api:commits';
        const CACHE_TTL = 60 * 60 * 1000; // 1 hora
        const url = this.config.getCommitsUrl(limit);

        // 1) Intentar caché fresco
        const freshCache = this._readLocalCache(CACHE_KEY, CACHE_TTL);
        if (freshCache) {
            return freshCache.data;
        }

        // 2) Fetch real
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('[fetcher] Commits API error:', response.status);
                // Fallback a caché expirado
                const expired = this._readLocalCache(CACHE_KEY, CACHE_TTL, true);
                return expired ? expired.data : [];
            }
            const data = await response.json();
            const result = Array.isArray(data) ? data : [];
            this._writeLocalCache(CACHE_KEY, result);
            return result;

        } catch (error) {
            console.warn('[fetcher] Commits fetch failed:', error.message);
            // Fallback a caché expirado
            const expired = this._readLocalCache(CACHE_KEY, CACHE_TTL, true);
            return expired ? expired.data : [];
        }
    }

    /**
     * Limpiar el caché persistente de las API calls.
     */
    clearApiCache() {
        localStorage.removeItem('gn:dashboard:api:filelist');
        localStorage.removeItem('gn:dashboard:api:commits');
    }
}
