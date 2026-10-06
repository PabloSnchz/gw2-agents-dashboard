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
        // Lee la lista de .md desde data/git.json (campo archivos_md), que
        // genera _eco\git_export.py con `git ls-files` del clon local.
        // Antes: contents API de GitHub. Con la cuota anonima agotada, esta
        // llamada devolvia 403 y el bloque se caia al catch y devolveia null
        // en silencio (ver fetchFileList: catch -> return null), dejando el
        // panel sin los .md auto-descubiertos y sin decir por que.
        const url = this.config.getGitDataUrl();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status + ' al leer data/git.json');
            const data = await response.json();
            const nombres = Array.isArray(data.archivos_md) ? data.archivos_md : [];
            const mdFiles = nombres
                .filter(n => n && n.endsWith('.md'))
                .map(n => ({
                    name: n,
                    zone: this.config.getZoneForFile(n),
                    label: this.config.getLabelForFile(n)
                }));
            return mdFiles.length > 0 ? mdFiles : null;
        } catch (error) {
            console.warn('[fetcher] lista de .md no disponible:', error.message);
            return null;
        }
    }

    /**
     * Carga la fuente de verdad de la ESTRUCTURA del ecosistema.
     * Vive en el repo del dashboard (data/estructura.json), NO en
     * gw2-wallet-agents: la estructura es responsabilidad del Arquitecto y el
     * equipo no tiene visibilidad de los permisos reales ni de la topologia de
     * clones. Si falla, el dashboard sigue igual: el tab Estructura lo avisa.
     */
    async fetchEstructura() {
        const url = this.config.getStructureUrl();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const json = await response.json();
            if (!json || !Array.isArray(json.agentes)) {
                throw new Error('el JSON no tiene la forma esperada');
            }
            return { success: true, data: json, error: null };
        } catch (error) {
            console.warn('[fetcher] estructura no disponible:', error.message);
            return { success: false, data: null, error: error.message };
        }
    }

    async fetchGitData() {
        const cfg = window.DASHBOARD_CONFIG;
        const url = (cfg && cfg.getGitDataUrl) ? cfg.getGitDataUrl() : null;
        if (!url) return { success: false, data: null, error: 'sin config de git' };
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const json = await response.json();
            return { success: true, data: json, error: null };
        } catch (error) {
            console.warn('[fetcher] git.json no disponible:', error.message);
            return { success: false, data: null, error: error.message };
        }
    }

    async fetchRamas() {
        const cfg = window.DASHBOARD_CONFIG;
        const url = (cfg && cfg.getRamasUrl) ? cfg.getRamasUrl() : null;
        if (!url) return { success: false, data: null, error: 'sin config de ramas' };
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const json = await response.json();
            if (!json || !Array.isArray(json.ramas)) throw new Error('el JSON no tiene la forma esperada');
            return { success: true, data: json, error: null };
        } catch (error) {
            console.warn('[fetcher] ramas no disponibles:', error.message);
            return { success: false, data: null, error: error.message };
        }
    }

    async fetchFeatures() {
        const cfg = window.DASHBOARD_CONFIG;
        const url = (cfg && cfg.getFeaturesUrl) ? cfg.getFeaturesUrl() : null;
        if (!url) return { success: false, content: null, error: 'sin config de features' };
        try {
            const response = await fetch(url);
            if (response.status === 404) {
                return { success: false, content: null, error: 'FEATURES.md no existe en agents/main' };
            }
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const text = await response.text();
            return { success: true, content: text, error: null };
        } catch (error) {
            console.warn('[fetcher] features no disponibles:', error.message);
            return { success: false, content: null, error: error.message };
        }
    }

    async fetchCommits(limit = 50) {
        // Los commits salen de data/git.json (campo commits), que git_export.py
        // arma con `git log` del clon local de gw2-dev. Antes: commits API con
        // la cuota agotada devolvia [] y el timeline salia vacio sin aviso.
        const url = this.config.getGitDataUrl();
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status + ' al leer data/git.json');
            const data = await response.json();
            const commits = Array.isArray(data.commits) ? data.commits : [];
            // mismo shape que devolvia la API, para no tocar el render
            return commits.slice(0, limit).map(c => ({
                sha: c.sha,
                commit: {
                    message: c.msg,
                    author: { name: c.autor, date: c.fecha }
                }
            }));
        } catch (error) {
            console.warn('[fetcher] commits no disponibles:', error.message);
            return [];
        }
    }
}
