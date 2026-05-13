"use strict";
// ============================================================
//  TEO — src/core/embedCache.ts
//  Cache em memória para embeddings
//
//  Usa Map com key baseada no hash do texto.
//  TTL de 1 hora para manter cache fresco.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheGet = cacheGet;
exports.cacheSet = cacheSet;
exports.cacheSize = cacheSize;
exports.cacheClear = cacheClear;
const crypto_1 = __importDefault(require("crypto"));
const CACHE = new Map();
const TTL_MS = 60 * 60 * 1000; // 1 hora
function hash(text) {
    return crypto_1.default.createHash('sha256').update(text).digest('hex').slice(0, 16);
}
function cacheGet(text) {
    const key = hash(text);
    const entry = CACHE.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
        CACHE.delete(key);
        return null;
    }
    return entry.embed;
}
function cacheSet(text, embed) {
    const key = hash(text);
    CACHE.set(key, { embed, timestamp: Date.now() });
}
function cacheSize() {
    return CACHE.size;
}
function cacheClear() {
    CACHE.clear();
}
//# sourceMappingURL=embedCache.js.map