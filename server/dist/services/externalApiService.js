"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchJsonWithTimeout = void 0;
const DEFAULT_TIMEOUT_MS = 5000;
const fetchJsonWithTimeout = async (url, init, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        return (await response.json());
    }
    finally {
        clearTimeout(timeoutId);
    }
};
exports.fetchJsonWithTimeout = fetchJsonWithTimeout;
