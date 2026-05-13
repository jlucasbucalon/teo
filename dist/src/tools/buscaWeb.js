"use strict";
// ============================================================
//  TEO — src/tools/buscaWeb.ts
//  Busca na web via Ollama Cloud API
//
//  Regra simples e previsível:
//    rapido   → não busca (foco em velocidade)
//    profundo → sempre busca (análises completas)
//
//  Melhorias sobre a versão anterior:
//    - Cache de buscas com TTL de 10 minutos
//    - Query otimizada automaticamente (remove ruído)
//    - Filtro de resultados por conteúdo mínimo
//    - Deduplicação por domínio
//    - Nunca lança exceção — sempre retorna RespostaBusca
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decidirBusca = decidirBusca;
exports.otimizarQuery = otimizarQuery;
exports.buscaWeb = buscaWeb;
exports.limparCacheBusca = limparCacheBusca;
const axios_1 = __importDefault(require("axios"));
const aios_1 = require("../aios");
// ── Configuração ─────────────────────────────────────────────
const BUSCA_URL = 'https://ollama.com/api/web_search';
const TIMEOUT_MS = 10_000;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const CONTEUDO_MINIMO = 50; // chars mínimos por resultado
function decidirBusca(modo) {
    if (modo === 'local') {
        return { buscar: false, maxResultados: 0 };
    }
    // profundo — sempre busca
    return { buscar: true, maxResultados: 5 };
}
const _cache = new Map();
function chaveCache(query, max) {
    return `${query.toLowerCase().trim()}::${max}`;
}
function lerCache(query, max) {
    const entrada = _cache.get(chaveCache(query, max));
    if (!entrada)
        return null;
    if (Date.now() > entrada.expiraEm) {
        _cache.delete(chaveCache(query, max));
        return null;
    }
    return entrada.resposta;
}
function salvarCache(query, max, resposta) {
    _cache.set(chaveCache(query, max), {
        resposta,
        expiraEm: Date.now() + CACHE_TTL,
    });
}
// ── Otimização de query ───────────────────────────────────────
const STOP_WORDS = new Set([
    'oque',
    'qual',
    'quais',
    'como',
    'quando',
    'onde',
    'porque',
    'quem',
    'quanto',
    'me',
    'meu',
    'minha',
    'você',
    'teo',
    'eu',
    'gostaria',
    'preciso',
    'quero',
    'pode',
    'poderia',
    'explica',
    'explique',
    'fala',
    'conta',
    'diz',
    'é',
    'de',
    'da',
    'do',
    'em',
    'um',
    'uma',
    'os',
    'as',
    'para',
    'com',
    'por',
    'se',
    'na',
    'no',
    'que',
    'e',
    'a',
    'o',
    'i',
    'u',
    'ou',
]);
/**
 * Otimiza a query antes de enviar para a API:
 * - Remove prefixo "teo" e pontuação
 * - Remove stop words
 * - Adiciona ano atual para nichos técnicos
 * - Limita tamanho a 100 chars
 */
function otimizarQuery(query, nicho) {
    const anoAtual = new Date().getFullYear();
    let q = query
        .replace(/^teo[,\s]*/i, '')
        .replace(/[?!]/g, '')
        .trim();
    const palavras = q
        .split(/\s+/)
        .filter((p) => p.length > 2 && !STOP_WORDS.has(p.toLowerCase()));
    q = palavras.join(' ');
    // Adiciona ano para nichos técnicos (programação, ciência, etc.)
    const nichosComAno = [
        'programacao',
        'ciencia',
        'tecnologia',
    ];
    if (nicho &&
        nichosComAno.includes(nicho) &&
        !q.includes(String(anoAtual))) {
        q = `${q} ${anoAtual}`;
    }
    return q.slice(0, 100).trim();
}
// ── Filtragem de resultados ───────────────────────────────────
function extrairDominio(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    }
    catch {
        return url;
    }
}
/**
 * Filtra resultados com conteúdo mínimo e deduplica por domínio.
 */
function filtrarResultados(resultados, max) {
    const dominiosVistos = new Set();
    return resultados
        .filter((r) => {
        if (!r.title || !r.url)
            return false;
        if (!r.content ||
            r.content.trim().length < CONTEUDO_MINIMO)
            return false;
        return true;
    })
        .filter((r) => {
        const dominio = extrairDominio(r.url);
        if (dominiosVistos.has(dominio))
            return false;
        dominiosVistos.add(dominio);
        return true;
    })
        .slice(0, max);
}
// ── Busca principal ───────────────────────────────────────────
async function buscaWeb(query, maxResultados = 5, nicho) {
    if (!aios_1.TEO.ollamaApiKey) {
        return {
            resultados: [],
            query,
            queryUsada: query,
            cached: false,
            erro: 'OLLAMA_API_KEY não configurada',
        };
    }
    // Otimiza a query antes de buscar
    const queryUsada = otimizarQuery(query, nicho);
    // Verifica cache — mesma query não faz duas requisições em 10 min
    const cached = lerCache(queryUsada, maxResultados);
    if (cached) {
        return { ...cached, cached: true };
    }
    try {
        // Pede um pouco mais para ter margem após filtragem
        const response = await axios_1.default.post(BUSCA_URL, { query: queryUsada, max_results: maxResultados + 2 }, {
            headers: {
                Authorization: `Bearer ${aios_1.TEO.ollamaApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: TIMEOUT_MS,
        });
        const brutos = (response.data?.results ?? []).map((r) => ({
            title: r.title ?? '',
            url: r.url ?? '',
            content: r.content ?? '',
        }));
        const resultados = filtrarResultados(brutos, maxResultados);
        const resposta = {
            resultados,
            query,
            queryUsada,
            cached: false,
        };
        salvarCache(queryUsada, maxResultados, resposta);
        return resposta;
    }
    catch (err) {
        const msg = err instanceof Error
            ? err.message
            : 'Erro desconhecido';
        return {
            resultados: [],
            query,
            queryUsada,
            cached: false,
            erro: msg,
        };
    }
}
/**
 * Limpa o cache de buscas manualmente.
 */
function limparCacheBusca() {
    _cache.clear();
}
//# sourceMappingURL=buscaWeb.js.map