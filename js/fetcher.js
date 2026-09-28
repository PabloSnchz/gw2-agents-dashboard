/**
 * js/fetcher.js
 * Fetcher de archivos .md desde raw.githubusercontent.com.
 * Incluye cache en memoria (5 min) y manejo de errores (404, network, invalid).
 */

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
        this.cache = new Map();
    }

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
            return null;
        }
    }

    async fetchCommits(limit = 50) {
        const url = this.config.getCommitsUrl(limit);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('[fetcher] Commits API error:', response.status);
                return [];
            }
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn('[fetcher] Commits fetch failed:', error.message);
            return [];
        }
    }
}
