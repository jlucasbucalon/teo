"use strict";
// ============================================================
//  TEO — src/core/understand.ts
//  Classificador de intenção — entende o que foi escrito no chat
//
//  Fluxo:
//    1. Recebe o input do usuário
//    2. Chama o LLM via ChatOllama (LangChain) para classificar
//    3. Retorna um objeto estruturado com o que entendeu
//    4. Grava o resultado em src/memory/context.log (sobrescreve)
//
//  Este módulo NÃO responde ao usuário — só classifica.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gravarClassificacao = gravarClassificacao;
exports.classificarRapido = classificarRapido;
exports.entender = entender;
exports.lerUltimoContexto = lerUltimoContexto;
const ollama_1 = require("@langchain/ollama");
const messages_1 = require("@langchain/core/messages");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const aios_1 = require("../aios");
const embed_1 = require("./embed");
const nichos_1 = require("../system/nichos");
// ── Caminhos ─────────────────────────────────────────────────
const MEMORY_DIR = path_1.default.resolve(__dirname, '../../src/memory');
const CONTEXT_LOG = path_1.default.join(MEMORY_DIR, 'context.log');
if (!fs_1.default.existsSync(MEMORY_DIR)) {
    fs_1.default.mkdirSync(MEMORY_DIR, { recursive: true });
}
// ── Prompt de classificação ──────────────────────────────────
function promptClassificacao(input) {
    const ids = (0, nichos_1.carregarNichos)()
        .map((n) => n.id)
        .join(' | ');
    return `Você é um classificador de intenção. Analise o texto e responda APENAS com JSON válido, sem explicações, sem markdown.

TEXTO: "${input}"

Retorne exatamente este JSON:
{
  "nicho": "<um de: ${ids}>",
  "tipo": "<um de: duvida | geracao | analise | instrucao | conversa | comando | indefinido>",
  "topico": "<resumo do assunto em no máximo 8 palavras>",
  "idioma": "<pt-BR | en | es | outro>",
  "confianca": <número entre 0.0 e 1.0>,
  "keys": ["<palavra-chave 1 do input>", "<palavra-chave 2>", "<palavra-chave 3>"],
  "related": ["<termo relacionado 1>", "<termo relacionado 2>", "<termo relacionado 3>"]
}`;
}
// ── Classificação via LangChain ChatOllama ───────────────────
async function classificarViaLLM(input) {
    const llm = new ollama_1.ChatOllama({
        baseUrl: aios_1.TEO.ollamaUrl,
        model: aios_1.TEO.modelo,
        temperature: 0.1,
        numPredict: 300,
        topK: 10,
        topP: 0.5,
    });
    try {
        // Timeout de 3s — cai no fallback se o modelo estiver ocupado
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
        const invoke = llm
            .invoke([
            new messages_1.HumanMessage(promptClassificacao(input)),
        ])
            .then((res) => {
            const raw = typeof res.content === 'string' ? res.content : '';
            const match = raw.match(/\{[\s\S]*?\}/);
            if (!match)
                return null;
            const parsed = JSON.parse(match[0]);
            if (!parsed.nicho || !parsed.tipo) {
                return null;
            }
            return {
                nicho: parsed.nicho,
                tipo: parsed.tipo,
                topico: parsed.topico ?? 'não identificado',
                idioma: parsed.idioma ?? 'pt-BR',
                confianca: parsed.confianca ?? 0.5,
                keys: Array.isArray(parsed.keys)
                    ? parsed.keys
                    : [],
                related: Array.isArray(parsed.related)
                    ? parsed.related
                    : [],
                embed: [],
                timestamp: new Date().toISOString(),
                input,
            };
        })
            .catch(() => null);
        return await Promise.race([invoke, timeout]);
    }
    catch {
        return null;
    }
}
// ── Fallback por palavras-chave ──────────────────────────────
function normalizeForMatching(str) {
    // Remove acentos e converte para lowercase
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
function matchKeyword(text, keyword) {
    const normalizedText = normalizeForMatching(text);
    const normalizedKeyword = normalizeForMatching(keyword);
    // Always use substring match for better matching
    return normalizedText.includes(normalizedKeyword);
}
// Remove prefixo "teo" e indicativos naturais antes de classificar
function normalizarInput(input) {
    return input
        .replace(/^teo[,\s]*/i, '')
        .replace(/^(eu quero|eu preciso|me explica|me fala|me diz|pode|poderia)\s+/i, '')
        .trim();
}
function classificarPorKeywords(input) {
    const nichos = (0, nichos_1.carregarNichos)();
    const t = normalizarInput(input).toLowerCase();
    let melhorNicho = 'geral';
    let melhorScore = 0;
    for (const nicho of nichos) {
        const score = nicho.keywords.filter((p) => matchKeyword(t, p)).length;
        if (score > melhorScore) {
            melhorScore = score;
            melhorNicho = nicho.id;
        }
    }
    return melhorNicho;
}
function detectarTipo(input) {
    const t = input.toLowerCase();
    if (/\?/.test(t) ||
        /^(o que|como|quando|onde|por que|qual|quem|quanto)/i.test(t))
        return 'duvida';
    if (/(escreve|cria|gera|faça|faz|monta|desenvolve|implemente)/i.test(t))
        return 'geracao';
    if (/(analisa|revisa|avalia|verifica|confere|corrige)/i.test(t))
        return 'analise';
    if (/(como fazer|passo a passo|me ensina|me explica|tutorial)/i.test(t))
        return 'instrucao';
    if (/(oi|olá|tudo bem|e aí|bom dia|boa tarde|boa noite)/i.test(t))
        return 'conversa';
    return 'indefinido';
}
function extrairKeys(input, nichoId) {
    const t = normalizarInput(input).toLowerCase();
    const nicho = (0, nichos_1.getNicho)(nichoId);
    const found = (nicho?.keywords ?? []).filter((p) => matchKeyword(t, p));
    if (found.length > 0)
        return found.slice(0, 5);
    return t
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
}
function extrairTopico(input) {
    return input
        .replace(/^teo[,\s]*/i, '') // remove prefixo "teo," ou "teo "
        .trim()
        .slice(0, 150)
        .trim();
}
function fallbackClassificacao(input) {
    const nichoId = classificarPorKeywords(input);
    const nicho = (0, nichos_1.getNicho)(nichoId);
    return {
        nicho: nichoId,
        tipo: detectarTipo(input),
        topico: extrairTopico(input),
        idioma: 'pt-BR',
        confianca: 0.4,
        keys: extrairKeys(input, nichoId),
        related: (nicho?.related ?? []).slice(0, 3),
        embed: [],
        timestamp: new Date().toISOString(),
        input,
    };
}
// ── Gravação no context.log ──────────────────────────────────
// Sobrescreve a cada novo input — janela do entendimento atual.
function gravarLog(compreensao, chatId) {
    const linhas = [
        `────────────────────────────────────────`,
        `[${compreensao.timestamp}]`,
        `chat     : ${chatId ?? 'sem chat aberto'}`,
        `input    : ${compreensao.input}`,
        `nicho    : ${compreensao.nicho}`,
        `tipo     : ${compreensao.tipo}`,
        `topico   : ${compreensao.topico}`,
        `idioma   : ${compreensao.idioma}`,
        `confiança: ${(compreensao.confianca * 100).toFixed(0)}%`,
        `keys     : ${compreensao.keys.join(', ')}`,
        `related  : ${compreensao.related.join(', ')}`,
        `embed    : ${(0, embed_1.embedPreview)(compreensao.embed)}`,
        '',
    ];
    fs_1.default.writeFileSync(CONTEXT_LOG, linhas.join('\n'), 'utf8');
}
// ── API pública ──────────────────────────────────────────────
// Grava a classificação no context.log — idempotente (sobrescreve).
// Usada pelo cli.ts para garantir que o log é sempre atualizado.
function gravarClassificacao(compreensao, chatId) {
    gravarLog(compreensao, chatId);
}
// Classificação instantânea por keywords — sem chamar LLM.
// Usada pelo graph.ts no understandNode para não bloquear a resposta.
function classificarRapido(input) {
    return fallbackClassificacao(input);
}
async function entender(input, chatId) {
    // Classificação e embedding em paralelo — independentes
    const [resultado, embed] = await Promise.all([
        classificarViaLLM(input),
        (0, embed_1.embedTexto)(input),
    ]);
    const compreensao = resultado ?? fallbackClassificacao(input);
    compreensao.embed = embed;
    gravarLog(compreensao, chatId);
    return compreensao;
}
function lerUltimoContexto() {
    if (!fs_1.default.existsSync(CONTEXT_LOG))
        return 'context.log vazio';
    return fs_1.default.readFileSync(CONTEXT_LOG, 'utf8').trim();
}
//# sourceMappingURL=understand.js.map