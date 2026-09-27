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
        const cacheKey = `${filename}:${new Date().toDateString()}`;

        // Cache check (salvo force)
        if (!force && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
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

            this.cache.set(cacheKey, result);
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
     * @returns {Promise<Array>} resultados con metadata de zona y label
     */
    async fetchAll(force = false) {
        const results = [];
        for (const file of this.config.files) {
            const result = await this.fetchFile(file.name, force);
            results.push({
                ...result,
                zone: file.zone,
                label: file.label
            });
        }
        return results;
    }
}
