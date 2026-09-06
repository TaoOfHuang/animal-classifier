"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiProviderConfig = void 0;
const getAiProviderConfig = () => {
    return {
        baseUrl: process.env.AI_BASE_URL || '',
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || '',
        provider: process.env.AI_PROVIDER?.toLowerCase() || '',
    };
};
exports.getAiProviderConfig = getAiProviderConfig;
