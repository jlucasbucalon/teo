"use strict";
// ============================================================
//  TEO — src/tools/lerVector.ts
//  Leitura dos .md dos nichos com busca semântica por seção.
//
//  Responsabilidade única: LER e CONSULTAR.
//  Escrita é responsabilidade exclusiva de escreverVector.ts.
//
//  Funcionalidades:
//    - Cache com TTL de 5 minutos
//    - Detecção de conteúdo real vs template vazio
//    - Timestamp real via fs.stat
//    - lerContexto()       → .md completo (para trainer)
//    - lerContextoFocado() → só seções relevantes (para agentes)
//    - Cache de embeddings por seção — recalcula só quando .md muda
//    - invalidarCache() para escreverVector.ts usar após escrita
//    - Nunca lança exceção
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lerNicho = lerNicho;
exports.lerContexto = lerContexto;
exports.lerContextoFocado = lerContextoFocado;
exports.invalidarCache = invalidarCache;
exports.listarNichos = listarNichos;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const embed_1 = require("../core/embed");
// ── Configuração ─────────────────────────────────────────────
const TRAINER_DIR = path_1.default.resolve(__dirname, '../../src/memory/trainer/nichos');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
// Pontuação mínima de similaridade para incluir uma seção
const SCORE_MINIMO = 0.3;
// Marcadores de template vazio — arquivo sem conhecimento real
const MARCADORES_VAZIO = [
    '_sem dados ainda_',
    'sem dados ainda',
    'última atualização: —',
];
if (!fs_1.default.existsSync(TRAINER_DIR)) {
    fs_1.default.mkdirSync(TRAINER_DIR, { recursive: true });
}
const _cache = new Map();
// ── Helpers ───────────────────────────────────────────────────
function detectarConhecimentoReal(conteudo) {
    if (!conteudo.trim())
        return false;
    const linhasSignificativas = conteudo
        .split('\n')
        .filter((linha) => {
        const l = linha.trim();
        if (!l)
            return false;
        if (l.startsWith('#'))
            return false;
        if (l.startsWith('_') && l.endsWith('_'))
            return false;
        if (MARCADORES_VAZIO.some((m) => l.includes(m)))
            return false;
        return true;
    });
    return linhasSignificativas.length >= 3;
}
function obterMtime(file) {
    try {
        return fs_1.default.statSync(file).mtimeMs;
    }
    catch {
        return 0;
    }
}
function obterDataModificacao(file) {
    try {
        return fs_1.default.statSync(file).mtime.toISOString();
    }
    catch {
        return new Date().toISOString();
    }
}
/**
 * Divide o .md em seções pelo header ##
 * Cada seção = título + corpo
 */
function dividirEmSecoes(conteudo) {
    const linhas = conteudo.split('\n');
    const secoes = [];
    let tituloAtual = '';
    let corpoAtual = [];
    for (const linha of linhas) {
        if (linha.startsWith('## ')) {
            // Salva seção anterior se tiver corpo
            if (tituloAtual && corpoAtual.join('').trim()) {
                const corpo = corpoAtual.join('\n').trim();
                secoes.push({
                    titulo: tituloAtual,
                    corpo,
                    texto: `${tituloAtual}\n${corpo}`,
                });
            }
            tituloAtual = linha.replace('## ', '').trim();
            corpoAtual = [];
        }
        else if (tituloAtual) {
            corpoAtual.push(linha);
        }
    }
    // Última seção
    if (tituloAtual && corpoAtual.join('').trim()) {
        const corpo = corpoAtual.join('\n').trim();
        secoes.push({
            titulo: tituloAtual,
            corpo,
            texto: `${tituloAtual}\n${corpo}`,
        });
    }
    return secoes;
}
/**
 * Filtra seções que têm conteúdo real (ignora seções vazias/template)
 */
function secoesSomentePleenas(secoes) {
    return secoes.filter((s) => {
        const corpo = s.corpo.trim();
        if (!corpo)
            return false;
        if (MARCADORES_VAZIO.some((m) => corpo.includes(m)))
            return false;
        return corpo.length > 20;
    });
}
/**
 * Gera embeddings para todas as seções em lote
 */
async function embedarSecoes(secoes) {
    if (!secoes.length)
        return [];
    const textos = secoes.map((s) => s.texto);
    const vetores = await (0, embed_1.embedLote)(textos).catch(() => secoes.map(() => []));
    return secoes.map((s, i) => ({
        ...s,
        embed: vetores[i] ?? [],
    }));
}
/**
 * Monta contexto focado a partir das seções mais relevantes
 */
function montarContextoFocado(nicho, secoes, topK) {
    if (!secoes.length)
        return '';
    const partes = [
        `## Conhecimento acumulado — ${nicho} (seções mais relevantes)`,
        ...secoes
            .slice(0, topK)
            .map((s) => `### ${s.titulo}\n${s.corpo}`),
    ];
    return partes.join('\n\n');
}
// ── Cache e leitura ───────────────────────────────────────────
/**
 * Garante que o cache está válido para o nicho.
 * Recalcula se: TTL expirou OU arquivo foi modificado desde o cache.
 */
async function garantirCache(nicho) {
    const file = path_1.default.join(TRAINER_DIR, `${nicho}.md`);
    const mtime = obterMtime(file);
    const agora = Date.now();
    const cached = _cache.get(nicho);
    // Cache válido: TTL ok E arquivo não mudou
    if (cached &&
        agora < cached.expiraEm &&
        cached.mtime === mtime) {
        return cached;
    }
    // Arquivo não existe
    if (!fs_1.default.existsSync(file)) {
        const entry = {
            nicho,
            conteudo: '',
            tamanho: 0,
            atualizadoEm: new Date().toISOString(),
            existe: false,
            temConhecimento: false,
            contexto: '',
        };
        const cacheEntry = {
            conteudo: entry,
            secoes: [],
            expiraEm: agora + CACHE_TTL,
            mtime: 0,
        };
        _cache.set(nicho, cacheEntry);
        return cacheEntry;
    }
    // Lê e processa o arquivo
    try {
        const conteudo = fs_1.default.readFileSync(file, 'utf8');
        const temConhecimento = detectarConhecimentoReal(conteudo);
        const atualizadoEm = obterDataModificacao(file);
        // Divide em seções e embeda as que têm conteúdo real
        const secoesRaw = dividirEmSecoes(conteudo);
        const secoesPleenas = secoesSomentePleenas(secoesRaw);
        const secoes = temConhecimento
            ? await embedarSecoes(secoesPleenas)
            : [];
        const contexto = temConhecimento
            ? `## Conhecimento acumulado — ${nicho}\n${conteudo.trim()}`
            : '';
        const entry = {
            nicho,
            conteudo,
            tamanho: conteudo.length,
            atualizadoEm,
            existe: true,
            temConhecimento,
            contexto,
        };
        const cacheEntry = {
            conteudo: entry,
            secoes,
            expiraEm: agora + CACHE_TTL,
            mtime,
        };
        _cache.set(nicho, cacheEntry);
        return cacheEntry;
    }
    catch {
        return null;
    }
}
// ── API pública ───────────────────────────────────────────────
/**
 * Lê os metadados e conteúdo do nicho.
 * Para o agente saber se vale injetar o contexto.
 */
async function lerNicho(nicho) {
    const cache = await garantirCache(nicho);
    if (!cache) {
        return {
            nicho,
            conteudo: '',
            tamanho: 0,
            atualizadoEm: new Date().toISOString(),
            existe: false,
            temConhecimento: false,
            contexto: '',
        };
    }
    return cache.conteudo;
}
/**
 * Retorna o .md completo formatado.
 * Usado pelo agenteTrainer — ele precisa de tudo para avaliar.
 */
async function lerContexto(nicho) {
    const n = await lerNicho(nicho);
    return n.contexto;
}
/**
 * Retorna APENAS as seções do .md mais relevantes para o input.
 * Usado pelos agentes de resposta — contexto focado, sem ruído.
 *
 * Algoritmo:
 *   1. Embeda o input do usuário
 *   2. Compara com embeddings de cada seção do .md
 *   3. Retorna as topK seções acima do score mínimo
 *   4. Monta contexto formatado pronto para injetar no prompt
 *
 * @param nicho   ID do nicho (ex: "programacao")
 * @param input   Pergunta do usuário (para calcular similaridade)
 * @param topK    Máximo de seções a retornar (padrão: 3)
 * @returns       String pronta para injetar no system prompt
 */
async function lerContextoFocado(nicho, input, topK = 3) {
    const cache = await garantirCache(nicho);
    if (!cache || !cache.conteudo.temConhecimento)
        return '';
    if (!cache.secoes.length)
        return '';
    // Embeda o input do usuário
    const inputEmbed = await (0, embed_1.embedTexto)(input).catch(() => []);
    if (!inputEmbed.length) {
        // Fallback: retorna .md completo se não conseguir embeding
        return cache.conteudo.contexto;
    }
    // Calcula similaridade de cosseno para cada seção
    const secoesComScore = cache.secoes
        .map((secao) => ({
        secao,
        score: secao.embed.length
            ? (0, embed_1.cosineSim)(inputEmbed, secao.embed)
            : 0,
    }))
        .filter((x) => x.score >= SCORE_MINIMO)
        .sort((a, b) => b.score - a.score);
    if (!secoesComScore.length) {
        // Nenhuma seção relevante — retorna contexto completo como fallback
        return cache.conteudo.contexto;
    }
    const secoesSelecionadas = secoesComScore
        .slice(0, topK)
        .map((x) => x.secao);
    return montarContextoFocado(nicho, secoesSelecionadas, topK);
}
/**
 * Invalida o cache de um nicho.
 * Deve ser chamado pelo escreverVector.ts após qualquer escrita.
 */
function invalidarCache(nicho) {
    _cache.delete(nicho);
}
/**
 * Lista todos os nichos disponíveis com metadados.
 */
async function listarNichos() {
    try {
        const arquivos = fs_1.default
            .readdirSync(TRAINER_DIR)
            .filter((f) => f.endsWith('.md'));
        return await Promise.all(arquivos.map((arquivo) => lerNicho(arquivo.replace('.md', ''))));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=lerVector.js.map